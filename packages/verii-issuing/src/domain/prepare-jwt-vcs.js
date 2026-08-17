/*
 * Copyright 2024 Velocity Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

const { toLower } = require('lodash/fp');
const { mapWithIndex } = require('@verii/common-functions');
const {
  generateJWAKeyPair,
  get2BytesHash,
  KeyAlgorithms,
} = require('@verii/crypto');
const {
  CredentialDataModelVersions,
  CredentialEnvelopeFormats,
  jsonLdToUnsignedVcJwtContent,
  jsonLdToUnsignedVcV2JwsContent,
  jwsSign,
  jwtSign,
} = require('@verii/jwt');
const { extractCredentialType } = require('@verii/vc-checks');
const { hashOffer } = require('./hash-offer');
const { buildRevocationUrl } = require('../adapters/build-revocation-url');
const { buildJsonLdCredential } = require('./build-jsonld-credential');
const { buildVcV2Credential } = require('./build-vc-v2-credential');
const {
  getCredentialSigningProfile,
} = require('../credential-signing-profile');

// eslint-disable-next-line max-len
/** @import { Issuer, AllocationListEntry, CredentialDataModelVersion, CredentialEnvelopeFormat, CredentialOffer, CredentialMetadata, CredentialTypeMetadata, Context, JsonLdCredential, VcV2Credential } from "../types/types" */

/**
 * Builds the VCs
 * @param {CredentialOffer[]} offers  array of offers
 * @param {string} credentialSubjectId  optional field if credential subject needs to be bound into the offer
 * @param {Issuer} issuer  the issuer
 * @param {AllocationListEntry[]} metadataEntries metadata entries
 * @param {AllocationListEntry[]} revocationListEntries revocation list entries
 * @param {{[Name: string]: CredentialTypeMetadata}} credentialTypesMap the credential types
 * @param {string[]} [credentialSigningAlgorithms] explicitly resolved key algorithms
 * @param {Context} context the context
 * @returns {Promise<{vcJwt: string, jsonLdCredential: JsonLdCredential, metadata: CredentialMetadata}[]>} the vc and its metadata
 */
const prepareJwtVcs = async (
  offers,
  credentialSubjectId,
  issuer,
  metadataEntries,
  revocationListEntries,
  credentialTypesMap,
  credentialSigningAlgorithms,
  context,
) =>
  prepareVersionedCredentials({
    context,
    credentialFormat: CredentialEnvelopeFormats.JWT_VC_JSON_LD,
    credentialSigningAlgorithms,
    credentialSubjectId,
    credentialTypesMap,
    issuer,
    metadataEntries,
    offers,
    revocationListEntries,
  }).then((credentials) =>
    credentials.map(({ issuanceResult, metadata }) => ({
      jsonLdCredential: issuanceResult.credential,
      metadata,
      vcJwt: issuanceResult.compact,
    })),
  );

/**
 * Builds version-specific credential representations from shared identity,
 * key, status, and anchoring inputs.
 * @param {object} options versioned preparation options
 * @param {Context} options.context application context
 * @param {string} options.credentialFormat explicit credential format
 * @param {string[]} [options.credentialSigningAlgorithms] resolved algorithms
 * @param {string} [options.credentialSubjectId] bound credential subject
 * @param {{[Name: string]: CredentialTypeMetadata}} options.credentialTypesMap credential type metadata
 * @param {Issuer} options.issuer issuer
 * @param {AllocationListEntry[]} options.metadataEntries metadata entries
 * @param {CredentialOffer[]} options.offers credential offers
 * @param {AllocationListEntry[]} options.revocationListEntries status entries
 * @returns {Promise<object[]>} signed neutral credentials and DLT metadata
 */
const prepareVersionedCredentials = async ({
  context,
  credentialFormat,
  credentialSigningAlgorithms,
  credentialSubjectId,
  credentialTypesMap,
  issuer,
  metadataEntries,
  offers,
  revocationListEntries,
}) =>
  Promise.all(
    mapWithIndex(async (offer, i) => {
      const metadataEntry = metadataEntries[i];
      const credentialType = extractCredentialType(offer);
      const configuredAlgorithm =
        credentialSigningAlgorithms?.[i] ??
        credentialTypesMap[credentialType].defaultSignatureAlgorithm;
      const signingProfile = getCredentialSigningProfile(
        configuredAlgorithm ?? KeyAlgorithms.SECP256K1,
      );

      const keyPair = generateJWAKeyPair(signingProfile.keyAlgorithm);

      if (
        configuredAlgorithm != null &&
        metadataEntry.algType !== signingProfile.algType
      ) {
        throw new Error(
          `Credential metadata algorithm does not match ${signingProfile.joseAlgorithm}`,
        );
      }

      const contentHash = hashOffer(offer);
      const credentialId = buildVelocityCredentialMetadataDID(
        metadataEntry,
        issuer,
        contentHash,
        context.config.includeContentHashInCredentialId,
      );
      const metadata = {
        ...metadataEntry,
        contentHash,
        credentialType,
        credentialTypeEncoded: get2BytesHash(credentialType), // TODO replace with bytes encoding from credentialMetadata
        publicKey: keyPair.publicKey,
      };
      const revocationUrl = buildRevocationUrl(
        revocationListEntries[i],
        issuer,
        context,
      );
      const credentialTypeMetadata =
        credentialTypesMap[metadata.credentialType];
      const { credential, dataModelVersion, envelopeFormat } =
        buildCredentialRepresentation({
          contentHash: metadata.contentHash,
          context,
          credentialFormat,
          credentialId,
          credentialSubjectId,
          credentialTypeMetadata,
          issuer,
          offer,
          revocationUrl,
        });
      const { header, payload, sign } = buildUnsignedCredentialEnvelope({
        credential,
        credentialFormat,
        credentialId,
        keyAlgorithm: signingProfile.keyAlgorithm,
      });
      const compact = await sign(payload, keyPair.privateKey, header);

      return {
        issuanceResult: {
          compact,
          credential,
          credentialId,
          credentialStatus: credential.credentialStatus,
          dataModelVersion,
          envelopeFormat,
          signingAlgorithm: signingProfile.joseAlgorithm,
        },
        metadata,
      };
    }, offers),
  );

/**
 * Builds the selected credential document.
 * @param {object} options representation dependencies
 * @param {string} options.contentHash offer content hash
 * @param {Context} options.context application context
 * @param {CredentialEnvelopeFormat} options.credentialFormat credential format
 * @param {string} options.credentialId credential identifier
 * @param {string} [options.credentialSubjectId] bound credential subject
 * @param {CredentialTypeMetadata} options.credentialTypeMetadata type metadata
 * @param {Issuer} options.issuer issuer
 * @param {CredentialOffer} options.offer credential offer
 * @param {string} options.revocationUrl credential status URL
 * @returns {{
 *   credential: JsonLdCredential | VcV2Credential,
 *   dataModelVersion: CredentialDataModelVersion,
 *   envelopeFormat: CredentialEnvelopeFormat
 * }} credential and neutral format metadata
 */
const buildCredentialRepresentation = ({
  contentHash,
  context,
  credentialFormat,
  credentialId,
  credentialSubjectId,
  credentialTypeMetadata,
  issuer,
  offer,
  revocationUrl,
}) => {
  if (credentialFormat === CredentialEnvelopeFormats.JWT_VC_JSON_LD) {
    return {
      credential: buildJsonLdCredential(
        issuer,
        credentialSubjectId,
        offer,
        credentialId,
        contentHash,
        credentialTypeMetadata,
        revocationUrl,
        context,
      ),
      dataModelVersion: CredentialDataModelVersions.V1_1,
      envelopeFormat: CredentialEnvelopeFormats.JWT_VC_JSON_LD,
    };
  }

  return {
    credential: buildVcV2Credential({
      contentHash,
      context,
      credentialId,
      credentialSubjectId,
      credentialTypeMetadata,
      issuer,
      offer,
      revocationUrl,
    }),
    dataModelVersion: CredentialDataModelVersions.V2_0,
    envelopeFormat: CredentialEnvelopeFormats.VC_JWT,
  };
};

/**
 * Builds the selected unsigned envelope without changing shared credential
 * identity or key material.
 * @param {object} options envelope dependencies
 * @param {JsonLdCredential | VcV2Credential} options.credential credential
 * @param {CredentialEnvelopeFormat} options.credentialFormat credential format
 * @param {string} options.credentialId credential identifier
 * @param {string} options.keyAlgorithm internal key algorithm
 * @returns {{
 *   header: object,
 *   payload: object,
 *   sign: (payload: object, keyOrSecret: object | string, header: object) => Promise<string>
 * }} unsigned envelope
 */
const buildUnsignedCredentialEnvelope = ({
  credential,
  credentialFormat,
  credentialId,
  keyAlgorithm,
}) => {
  const kid = `${credentialId}#key-1`;
  if (credentialFormat === CredentialEnvelopeFormats.JWT_VC_JSON_LD) {
    return {
      ...jsonLdToUnsignedVcJwtContent(credential, keyAlgorithm, kid),
      sign: jwtSign,
    };
  }
  return {
    ...jsonLdToUnsignedVcV2JwsContent(credential, keyAlgorithm, kid),
    sign: jwsSign,
  };
};

/**
 * Builds a credential metadata DID URI
 * @param {AllocationListEntry} entry the list entry
 * @param {Issuer} issuer the issuer
 * @param {string} contentHash the content hash of the credential
 * @param {boolean} includeContentHashInCredentialId whether to include the content hash in the id
 * @returns {string} the DID URI for the location on the credential metadata list
 */
const buildVelocityCredentialMetadataDID = (
  entry,
  issuer,
  contentHash,
  includeContentHashInCredentialId,
) => {
  const id = `did:velocity:v2:${toLower(issuer.dltPrimaryAddress)}:${
    entry.listId
  }:${entry.index}`;
  if (includeContentHashInCredentialId) {
    return `${id}:${contentHash}`;
  }
  return id;
};

module.exports = { prepareJwtVcs, prepareVersionedCredentials };
