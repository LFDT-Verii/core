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
const {
  allocateGenericListEntries,
  allocateMetadataListEntries,
} = require('./allocate-list-entries');
const {
  initCredentialMetadataContract,
} = require('./adapters/init-credential-metadata-contract');
const { createRevocationList } = require('./adapters/create-revocation-list');
const { getCredentialSigningProfile } = require('./credential-signing-profile');
const {
  getCredentialFormatHandler,
  prepareCredentials,
} = require('./domain/prepare-credentials');

const REVOCATION_LIST_SIZE = 10240;
const METADATA_LIST_SIZE = 10000;

/** @import { AllocationListEntry, Context, CredentialIssuingOptions } from "../types/types" */
/** @import { CredentialMetadata, CredentialOffer } from "../types/types" */
/** @import { CredentialSigningResult, CredentialTypeMetadata } from "../types/types" */
/** @import { IssuedCredential, Issuer } from "../types/types" */

/**
 * Prepares, secures, and anchors a credential batch in one selected format.
 * @param {CredentialIssuingOptions} options credential issuing options
 * @returns {Promise<IssuedCredential[]>} issued credentials in offer order
 */
const issueCredentials = async (options) => {
  const signedCredentials = await signCredentials(options);

  await anchorVeriiCredentials(
    map('metadata', signedCredentials),
    options.issuer,
    options.context,
  );

  return map('issuedCredential', signedCredentials);
};

/**
 * Prepares and secures a credential batch without anchoring it.
 * @param {CredentialIssuingOptions} options credential signing options
 * @returns {Promise<CredentialSigningResult[]>} secured credentials and DLT metadata
 */
const signCredentials = async ({
  context,
  credentialFormat,
  credentialSigningAlgorithms,
  credentialSubjectId,
  credentialTypesMap,
  issuer,
  offers,
}) => {
  // Resolve the handler before allocating durable list entries.
  getCredentialFormatHandler(credentialFormat);
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

  return prepareCredentials({
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
  issueCredentials,
  signCredentials,
};
