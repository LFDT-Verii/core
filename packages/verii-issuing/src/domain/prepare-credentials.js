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
/** @import { Issuer, AllocationListEntry, CredentialFormat, CredentialOffer, CredentialMetadata, CredentialTypeMetadata, Context, JsonLdCredential, VcV2Credential, VcV2CredentialBuildOptions } from "../types/types" */

/**
 * @typedef {object} UnsignedCredential
 * @property {object} header protected header
 * @property {object} payload signing payload
 * @property {(payload: object, keyOrSecret: object | string, header: object) => Promise<string>} sign signing function
 */

/**
 * Builds secured credential representations from shared identity, key, status,
 * and anchoring inputs.
 * @param {object} options credential preparation options
 * @param {Context} options.context application context
 * @param {CredentialFormat} options.credentialFormat credential format
 * @param {string[]} [options.credentialSigningAlgorithms] resolved algorithms
 * @param {string} [options.credentialSubjectId] bound credential subject
 * @param {{[Name: string]: CredentialTypeMetadata}} options.credentialTypesMap credential type metadata
 * @param {Issuer} options.issuer issuer
 * @param {AllocationListEntry[]} options.metadataEntries metadata entries
 * @param {CredentialOffer[]} options.offers credential offers
 * @param {AllocationListEntry[]} options.revocationListEntries status entries
 * @returns {Promise<object[]>} signed neutral credentials and DLT metadata
 */
const prepareCredentials = async ({
  context,
  credentialFormat,
  credentialSigningAlgorithms,
  credentialSubjectId,
  credentialTypesMap,
  issuer,
  metadataEntries,
  offers,
  revocationListEntries,
}) => {
  const formatHandler = getCredentialFormatHandler(credentialFormat);

  return Promise.all(
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
      const credential = formatHandler.buildCredential({
        contentHash: metadata.contentHash,
        context,
        credentialId,
        credentialSubjectId,
        credentialTypeMetadata,
        issuer,
        offer,
        revocationUrl,
      });
      const { header, payload, sign } = formatHandler.buildUnsignedCredential({
        credential,
        credentialId,
        keyAlgorithm: signingProfile.keyAlgorithm,
      });
      const securedCredential = await sign(payload, keyPair.privateKey, header);

      return {
        issuedCredential: {
          credential,
          credentialFormat,
          credentialId,
          credentialStatus: credential.credentialStatus,
          dataModelVersion: formatHandler.dataModelVersion,
          securedCredential,
          securingMechanism: {
            algorithm: signingProfile.joseAlgorithm,
            type: 'jose',
          },
        },
        metadata,
      };
    }, offers),
  );
};

/**
 * Returns the implementation registered for a credential format.
 * @param {CredentialFormat} credentialFormat credential format
 * @returns {object} credential format handler
 */
const getCredentialFormatHandler = (credentialFormat) => {
  const formatHandler = credentialFormatHandlers[credentialFormat];
  if (formatHandler == null) {
    throw new TypeError('A credential batch must use one supported format');
  }
  return formatHandler;
};

/**
 * Builds a W3C VC 1.1 JSON-LD credential for a JWT envelope.
 * @param {object} options credential dependencies
 * @param {string} options.contentHash offer content hash
 * @param {Context} options.context application context
 * @param {string} options.credentialId credential identifier
 * @param {string} [options.credentialSubjectId] bound credential subject
 * @param {CredentialTypeMetadata} options.credentialTypeMetadata type metadata
 * @param {Issuer} options.issuer issuer
 * @param {CredentialOffer} options.offer credential offer
 * @param {string} options.revocationUrl credential status URL
 * @returns {JsonLdCredential} credential document
 */
const buildJwtVcJsonLdCredential = ({
  contentHash,
  context,
  credentialId,
  credentialSubjectId,
  credentialTypeMetadata,
  issuer,
  offer,
  revocationUrl,
}) =>
  buildJsonLdCredential(
    issuer,
    credentialSubjectId,
    offer,
    credentialId,
    contentHash,
    credentialTypeMetadata,
    revocationUrl,
    context,
  );

/**
 * Builds a W3C VC 2.0 credential for a VC-JWT envelope.
 * @param {VcV2CredentialBuildOptions} options credential dependencies
 * @returns {VcV2Credential} credential document
 */
const buildVcJwtCredential = (options) => buildVcV2Credential(options);

/**
 * Builds an unsigned JWT-VC JSON-LD representation.
 * @param {object} options envelope dependencies
 * @param {JsonLdCredential} options.credential credential document
 * @param {string} options.credentialId credential identifier
 * @param {string} options.keyAlgorithm internal key algorithm
 * @returns {UnsignedCredential} unsigned credential
 */
const buildUnsignedJwtVcJsonLdCredential = ({
  credential,
  credentialId,
  keyAlgorithm,
}) => {
  const kid = `${credentialId}#key-1`;
  return {
    ...jsonLdToUnsignedVcJwtContent(credential, keyAlgorithm, kid),
    sign: jwtSign,
  };
};

/**
 * Builds an unsigned VC-JWT representation.
 * @param {object} options envelope dependencies
 * @param {VcV2Credential} options.credential credential document
 * @param {string} options.credentialId credential identifier
 * @param {string} options.keyAlgorithm internal key algorithm
 * @returns {UnsignedCredential} unsigned credential
 */
const buildUnsignedVcJwtCredential = ({
  credential,
  credentialId,
  keyAlgorithm,
}) => ({
  ...jsonLdToUnsignedVcV2JwsContent(
    credential,
    keyAlgorithm,
    `${credentialId}#key-1`,
  ),
  sign: jwsSign,
});

const credentialFormatHandlers = Object.freeze({
  [CredentialEnvelopeFormats.JWT_VC_JSON_LD]: Object.freeze({
    buildCredential: buildJwtVcJsonLdCredential,
    buildUnsignedCredential: buildUnsignedJwtVcJsonLdCredential,
    dataModelVersion: CredentialDataModelVersions.V1_1,
  }),
  [CredentialEnvelopeFormats.VC_JWT]: Object.freeze({
    buildCredential: buildVcJwtCredential,
    buildUnsignedCredential: buildUnsignedVcJwtCredential,
    dataModelVersion: CredentialDataModelVersions.V2_0,
  }),
});

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

module.exports = { getCredentialFormatHandler, prepareCredentials };
