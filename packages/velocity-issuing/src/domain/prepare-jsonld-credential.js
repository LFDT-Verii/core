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

const { VnfProtocolVersions } = require('@verii/vc-checks');
const { toRelativeServiceId } = require('@verii/did-doc');
const { castArray, isEmpty, isObject, omit, uniq } = require('lodash/fp');
const { VelocityRevocationListType } = require('@verii/vc-checks');
const { VELOCITY_NETWORK_CREDENTIAL_TYPE } = require('../utils/constants');

/** @import { Issuer, CredentialTypeMetadata, VelocityOffer, Context, JsonLdCredential, LinkedData, CredentialSubject } from "../types/types" */

/**
 * Prepares a json-ld credential from an offer
 * @param {Issuer} issuer the issuer
 * @param {string | undefined} credentialSubjectId id of the credential subject to bind into the credential
 * @param {VelocityOffer} offer offer to generate from
 * @param {string} credentialId id of the credential
 * @param {string} contentHash hash of the raw credentialSubject and validity values
 * @param {CredentialTypeMetadata} credentialTypeMetadata credentialType metadata
 * @param {string} revocationUrl revocationUrl for this offer
 * @param {Context} context context
 * @returns {JsonLdCredential} a json-ld formatted unsigned credential
 */
const prepareJsonLdCredential = (
  issuer,
  credentialSubjectId,
  offer,
  credentialId,
  contentHash,
  credentialTypeMetadata,
  revocationUrl,
  context
) => {
  const {
    config: { credentialExtensionsContextUrl },
  } = context;

  const layerCredentialType = credentialTypeMetadata?.layer1
    ? VELOCITY_NETWORK_CREDENTIAL_TYPE.LAYER_1
    : VELOCITY_NETWORK_CREDENTIAL_TYPE.LAYER_2;
  const credentialContexts = uniq([
    'https://www.w3.org/2018/credentials/v1',
    ...buildCredentialTypeJsonLdContext(credentialTypeMetadata),
    ...extractJsonLdContext(offer),
    credentialExtensionsContextUrl,
  ]);
  return {
    ...cleanOffer(offer),
    '@context': credentialContexts,
    id: credentialId,
    type: uniq([
      ...castArray(offer.type),
      layerCredentialType,
      'VerifiableCredential',
    ]),
    issuer:
      offer.issuer != null && isObject(offer.issuer)
        ? {
            id: issuer.did,
            ...omit(['vendorOrganizationId'], offer.issuer),
          }
        : { id: issuer.did },
    issuanceDate: new Date().toISOString(),
    credentialSubject: buildCredentialSubject(
      offer,
      credentialSubjectId,
      credentialContexts,
      context
    ),
    credentialSchema: offer.credentialSchema ?? {
      type: 'JsonSchemaValidator2018',
      id: credentialTypeMetadata.schemaUrl,
    },
    credentialStatus: buildCredentialStatus(offer, revocationUrl),
    refreshService: buildRefreshService(issuer, offer),
    contentHash: {
      type: 'VelocityContentHash2020',
      value: contentHash,
    },
    vnfProtocolVersion: isEmpty(credentialSubjectId)
      ? VnfProtocolVersions.VNF_PROTOCOL_VERSION_1
      : VnfProtocolVersions.VNF_PROTOCOL_VERSION_2,
  };
};

const cleanOffer = omit([
  // these values shouldn't have been selected from the db
  '_id',
  'exchangeId',
  'offerId',
  'offerCreationDate',
  'offerExpirationDate',
  'issuer.vendorOrganizationId',
  'createdAt',
  'updatedAt',
  'linkedCredentials',
  'consentedAt',
  'rejectedAt',
]);

/**
 * Builds credential status for the credential
 * @param {VelocityOffer} offer the offer
 * @param {string} credentialSubjectId the credential subject id
 * @param {Array} credentialContexts the credential contexts
 * @param {Context} context the context
 * @returns {CredentialSubject} the credential subject
 */
const buildCredentialSubject = (
  { credentialSubject },
  credentialSubjectId,
  credentialContexts,
  context
) => {
  const result = omit(['vendorUserId'], credentialSubject);
  if (!isEmpty(credentialSubjectId)) {
    // eslint-disable-next-line better-mutation/no-mutation
    result.id = credentialSubjectId;
  }
  if (context.config.credentialSubjectContext === true) {
    // eslint-disable-next-line better-mutation/no-mutation
    result['@context'] = credentialContexts;
  }
  return result;
};

/**
 * Builds credential status for the credential
 * @param {VelocityOffer} offer the offer
 * @param {string} velocityRevocationUrl the revocation url
 * @returns {LinkedData | LinkedData[]} the credential status
 */
const buildCredentialStatus = (offer, velocityRevocationUrl) => {
  const velocityCredentialStatus = {
    type: VelocityRevocationListType,
    id: velocityRevocationUrl,
  };

  return addToPolymorphicArray(
    velocityCredentialStatus,
    offer.credentialStatus
  );
};

/**
 * Builds refresh service(s)
 * @param {Issuer} issuer the issuer
 * @param {VelocityOffer} offer the offer
 * @returns {LinkedData | LinkedData[]} the refreshservices for this offer
 */
const buildRefreshService = (issuer, offer) => {
  const defaultRefreshService = {
    type: 'VelocityNetworkRefreshService2024',
    id: `${issuer.did}${toRelativeServiceId(issuer.issuingServiceId)}`,
  };
  return addToPolymorphicArray(defaultRefreshService, offer.refreshService);
};

/**
 * Adds to a polymorphic string array
 * @param {string} newVal the new value to add
 * @param {undefined | null | string | string[]} existingVal the existing value if any
 * @returns {string | string[]} the new value
 */
const addToPolymorphicArray = (newVal, existingVal) => {
  if (existingVal == null) {
    return newVal;
  }
  const array = castArray(existingVal);
  // eslint-disable-next-line better-mutation/no-mutating-methods
  array.push(newVal);
  return array;
};

/**
 * Extracts json ld context values as an string array
 * @param {{"@context"?: string | string[]}} jsonLd any jsonLd
 * @returns {string[]} the array of jsonLD contexts
 */
const extractJsonLdContext = ({ '@context': jsonLdContext } = {}) =>
  jsonLdContext == null ? [] : castArray(jsonLdContext);

/**
 * Builds json ld context for the credential type
 * @param {CredentialTypeMetadata} credentialTypeMetadata credential type metadata
 * @returns {string[]} an array of strings
 */
const buildCredentialTypeJsonLdContext = (credentialTypeMetadata) =>
  credentialTypeMetadata.jsonldContext != null
    ? castArray(credentialTypeMetadata.jsonldContext)
    : [];

module.exports = {
  prepareJsonLdCredential,
};
