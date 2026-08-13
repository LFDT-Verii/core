/**
 * Copyright 2023 Velocity Team
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
 */

const { extractCredentialType } = require('@verii/vc-checks');
const { map } = require('lodash/fp');
const { CredentialEnvelopeFormats } = require('@verii/jwt');
const {
  allocateGenericListEntries,
  allocateMetadataListEntries,
} = require('./allocate-list-entries');
const {
  initCredentialMetadataContract,
} = require('./adapters/init-credential-metadata-contract');
const { createRevocationList } = require('./adapters/create-revocation-list');
const { getCredentialSigningProfile } = require('./credential-signing-profile');
const { prepareVersionedCredentials } = require('./domain/prepare-jwt-vcs');

const REVOCATION_LIST_SIZE = 10240;
const METADATA_LIST_SIZE = 10000;

/** @import { Issuer, AllocationListEntry, CredentialOffer, CredentialMetadata, CredentialTypeMetadata, Context } from "../types/types" */

/**
 * Prepares, signs and anchors a verifiable credential from a credential offer.
 * @param {CredentialOffer[]} offers  array of offers
 * @param {string} credentialSubjectId  optional field if credential subject needs to be bound into the offer
 * @param {{[Name: string]: CredentialTypeMetadata}} credentialTypesMap the credential types metadata
 * @param {Issuer} issuer  the issuer
 * @param {string[]} [credentialSigningAlgorithms] explicitly resolved key algorithms
 * @param {Context} context the context
 * @returns {Promise<string[]>} Returns signed credentials for each offer in vc-jwt format
 */
const issueVeriiCredentials = async (
  offers,
  credentialSubjectId,
  credentialTypesMap,
  issuer,
  credentialSigningAlgorithms,
  context,
) => {
  const results = await issueVersionedCredentials({
    context,
    credentialFormat: CredentialEnvelopeFormats.JWT_VC_JSON_LD,
    credentialSigningAlgorithms,
    credentialSubjectId,
    credentialTypesMap,
    issuer,
    offers,
  });

  return map('compact', results);
};

/**
 * Issues a credential batch in one explicitly selected representation.
 * @param {object} options versioned issuance options
 * @param {Context} options.context application context
 * @param {string} options.credentialFormat explicit credential format
 * @param {string[]} [options.credentialSigningAlgorithms] resolved algorithms
 * @param {string} [options.credentialSubjectId] bound credential subject
 * @param {{[Name: string]: CredentialTypeMetadata}} options.credentialTypesMap credential type metadata
 * @param {Issuer} options.issuer issuer
 * @param {CredentialOffer[]} options.offers credential offers
 * @returns {Promise<object[]>} neutral issuance results in offer order
 */
const issueVersionedCredentials = async (options) => {
  const signedCredentials = await signVersionedCredentials(options);

  await anchorVeriiCredentials(
    map('metadata', signedCredentials),
    options.issuer,
    options.context,
  );

  return map('issuanceResult', signedCredentials);
};

/**
 * Prepares and signs verifiable credentials from local offers without anchoring them to the blockchain.
 * Assumption is that credential offers contain all required fields including '@context', type, contentHash
 * @param {CredentialOffer[]} offers  array of offers
 * @param {string} credentialSubjectId  optional field if credential subject needs to be bound into the offer
 * @param {{[Name: string]: CredentialTypeMetadata}} credentialTypesMap the credential types metadata
 * @param {Issuer} issuer  the issuer
 * @param {string[]} [credentialSigningAlgorithms] explicitly resolved key algorithms
 * @param {Context} context the context
 * @returns {Promise<{vcJwt: string, metadata: CredentialMetadata}[]>} Returns array of signed vcs (in jwt format) and their metadata
 */
const signVeriiCredentials = async (
  offers,
  credentialSubjectId,
  credentialTypesMap,
  issuer,
  credentialSigningAlgorithms,
  context,
) => {
  const signedCredentials = await signVersionedCredentials({
    context,
    credentialFormat: CredentialEnvelopeFormats.JWT_VC_JSON_LD,
    credentialSigningAlgorithms,
    credentialSubjectId,
    credentialTypesMap,
    issuer,
    offers,
  });

  return signedCredentials.map(({ issuanceResult, metadata }) => ({
    jsonLdCredential: issuanceResult.credential,
    metadata,
    vcJwt: issuanceResult.compact,
  }));
};

/**
 * Prepares and signs an explicitly selected credential representation without
 * anchoring it.
 * @param {object} options versioned signing options
 * @param {Context} options.context application context
 * @param {string} options.credentialFormat explicit credential format
 * @param {string[]} [options.credentialSigningAlgorithms] resolved algorithms
 * @param {string} [options.credentialSubjectId] bound credential subject
 * @param {{[Name: string]: CredentialTypeMetadata}} options.credentialTypesMap credential type metadata
 * @param {Issuer} options.issuer issuer
 * @param {CredentialOffer[]} options.offers credential offers
 * @returns {Promise<object[]>} signed neutral results and DLT metadata
 */
const signVersionedCredentials = async ({
  context,
  credentialFormat,
  credentialSigningAlgorithms,
  credentialSubjectId,
  credentialTypesMap,
  issuer,
  offers,
}) => {
  assertCredentialFormat(credentialFormat);
  const effectiveCredentialSigningAlgorithms =
    resolveEffectiveCredentialSigningAlgorithms(
      offers,
      credentialTypesMap,
      credentialSigningAlgorithms,
    );
  const metadataEntries = await allocateMetadataListEntries(
    offers,
    credentialTypesMap,
    issuer,
    METADATA_LIST_SIZE,
    effectiveCredentialSigningAlgorithms,
    context,
  );
  const newMetadataListEntries = getNewListEntries(metadataEntries);
  if (newMetadataListEntries.length > 0) {
    const { createList } = await initCredentialMetadataContract(
      issuer,
      context,
    );
    for (const newMetadataListEntry of newMetadataListEntries) {
      // eslint-disable-next-line no-await-in-loop
      await createList(
        newMetadataListEntry.listId,
        newMetadataListEntry.algType,
      );
    }
  }

  // pre-allocate list entries using internal tables/collections
  const revocationListEntries = await allocateGenericListEntries(
    offers.length,
    issuer,
    'revocationListAllocations',
    REVOCATION_LIST_SIZE,
    context,
  );
  const [newRevocationListEntry] = getNewListEntries(revocationListEntries);
  if (newRevocationListEntry != null) {
    await createRevocationList(newRevocationListEntry.listId, issuer, context);
  }

  return prepareVersionedCredentials({
    context,
    credentialFormat,
    credentialSigningAlgorithms: effectiveCredentialSigningAlgorithms,
    credentialSubjectId,
    credentialTypesMap,
    issuer,
    metadataEntries,
    offers,
    revocationListEntries,
  });
};

/**
 * Validates that one supported format applies to the whole batch.
 * @param {unknown} credentialFormat credential format candidate
 * @returns {void}
 */
const assertCredentialFormat = (credentialFormat) => {
  if (!Object.values(CredentialEnvelopeFormats).includes(credentialFormat)) {
    throw new TypeError('A credential batch must use one supported format');
  }
};

/**
 * Resolves and validates the effective signing algorithm for every offer.
 * @param {CredentialOffer[]} offers array of offers
 * @param {{[Name: string]: CredentialTypeMetadata}} credentialTypesMap the credential types metadata
 * @param {string[]} [credentialSigningAlgorithms] explicitly resolved key algorithms
 * @returns {(string | undefined)[]} the effective algorithms in offer order
 */
const resolveEffectiveCredentialSigningAlgorithms = (
  offers,
  credentialTypesMap,
  credentialSigningAlgorithms,
) =>
  offers.map((offer, index) => {
    const credentialType = extractCredentialType(offer);
    const algorithm =
      credentialSigningAlgorithms?.[index] ??
      credentialTypesMap?.[credentialType]?.defaultSignatureAlgorithm;

    if (algorithm != null) {
      getCredentialSigningProfile(algorithm);
    }

    return algorithm;
  });

/**
 * Anchors prepared verifiable credentials to the blockchain using their credential metadata.
 * @param {CredentialMetadata[]} credentialMetadatas array of verifiable credential metadata
 * @param {Issuer} issuer  the issuer
 * @param {Context} context the context
 */
const anchorVeriiCredentials = async (credentialMetadatas, issuer, context) => {
  const { addEntry } = await initCredentialMetadataContract(issuer, context);

  // create credential metadata entries on dlt
  await Promise.all(map((metadata) => addEntry(metadata), credentialMetadatas));
};

/**
 * Gets the new list entries. Multiple new list entries can be returned, especially when different algorithm types are used.
 * @param {AllocationListEntry[]} entries the entries
 * @returns {AllocationListEntry[]} returns the new list entries if they exist, otherwise an empty array
 */
const getNewListEntries = (entries) =>
  entries.filter((entry) => entry.isNewList);

module.exports = {
  anchorVeriiCredentials,
  issueVeriiCredentials,
  issueVersionedCredentials,
  signVeriiCredentials,
  signVersionedCredentials,
};
