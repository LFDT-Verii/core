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
const { buildVcdmV1Credential } = require('./build-vcdm-v1-credential');
const { buildVcdmV2Credential } = require('./build-vcdm-v2-credential');
const {
  getCredentialSigningProfile,
} = require('../credential-signing-profile');

// eslint-disable-next-line max-len
/** @import { Issuer, AllocationListEntry, CredentialFormat, CredentialOffer, CredentialMetadata, CredentialTypeMetadata, Context, JsonLdCredential, VcV2Credential } from "../types/types" */

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
 * @returns {Promise<object[]>} secured credentials and DLT metadata
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
  const formatProfile = getCredentialFormatProfile(credentialFormat);

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
      const credential = formatProfile.buildCredential({
        contentHash: metadata.contentHash,
        context,
        credentialId,
        credentialSubjectId,
        credentialTypeMetadata,
        issuer,
        offer,
        revocationUrl,
      });
      const securedCredential = await formatProfile.secureCredential({
        credential,
        credentialId,
        keyAlgorithm: signingProfile.keyAlgorithm,
        privateKey: keyPair.privateKey,
      });

      return {
        issuedCredential: {
          credential,
          credentialFormat,
          credentialId,
          credentialStatus: credential.credentialStatus,
          dataModelVersion: formatProfile.dataModelVersion,
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
 * Returns the model builder and securing implementation registered for a
 * credential format.
 * @param {CredentialFormat} credentialFormat credential format
 * @returns {object} credential format profile
 */
const getCredentialFormatProfile = (credentialFormat) => {
  const formatProfile = credentialFormatProfiles[credentialFormat];
  if (formatProfile == null) {
    throw new TypeError('A credential batch must use one supported format');
  }
  return formatProfile;
};

/**
 * Secures a VCDM 1.1 credential as a legacy JWT-VC JSON-LD representation.
 * @param {object} options envelope dependencies
 * @param {JsonLdCredential} options.credential credential document
 * @param {string} options.credentialId credential identifier
 * @param {string} options.keyAlgorithm internal key algorithm
 * @param {object | string} options.privateKey signing key
 * @returns {Promise<string>} secured credential
 */
const secureJwtVcJsonLdCredential = ({
  credential,
  credentialId,
  keyAlgorithm,
  privateKey,
}) => {
  const kid = `${credentialId}#key-1`;
  const { header, payload } = jsonLdToUnsignedVcJwtContent(
    credential,
    keyAlgorithm,
    kid,
  );
  return jwtSign(payload, privateKey, header);
};

/**
 * Secures a VCDM 2.0 credential as a VC-JWT compact JWS.
 * @param {object} options envelope dependencies
 * @param {VcV2Credential} options.credential credential document
 * @param {string} options.credentialId credential identifier
 * @param {string} options.keyAlgorithm internal key algorithm
 * @param {object | string} options.privateKey signing key
 * @returns {Promise<string>} secured credential
 */
const secureVcJwtCredential = ({
  credential,
  credentialId,
  keyAlgorithm,
  privateKey,
}) => {
  const { header, payload } = jsonLdToUnsignedVcV2JwsContent(
    credential,
    keyAlgorithm,
    `${credentialId}#key-1`,
  );
  return jwsSign(payload, privateKey, header);
};

const credentialFormatProfiles = Object.freeze({
  [CredentialEnvelopeFormats.JWT_VC_JSON_LD]: Object.freeze({
    buildCredential: buildVcdmV1Credential,
    dataModelVersion: CredentialDataModelVersions.V1_1,
    secureCredential: secureJwtVcJsonLdCredential,
  }),
  [CredentialEnvelopeFormats.VC_JWT]: Object.freeze({
    buildCredential: buildVcdmV2Credential,
    dataModelVersion: CredentialDataModelVersions.V2_0,
    secureCredential: secureVcJwtCredential,
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

module.exports = { getCredentialFormatProfile, prepareCredentials };
