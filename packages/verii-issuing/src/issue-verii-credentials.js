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

const { map } = require('lodash/fp');
const {
  allocateGenericListEntries,
  allocateMetadataListEntries,
} = require('./allocate-list-entries');
const {
  initCredentialMetadataContract,
} = require('./adapters/init-credential-metadata-contract');
const { createRevocationList } = require('./adapters/create-revocation-list');
const { prepareJwtVcs } = require('./domain/prepare-jwt-vcs');

const REVOCATION_LIST_SIZE = 10240;
const METADATA_LIST_SIZE = 10000;

/** @import { Issuer, AllocationListEntry, CredentialOffer, CredentialMetadata, CredentialTypeMetadata, Context } from "../types/types" */

/**
 * Prepares, signs and anchors a verifiable credential from a credential offer.
 * @param {CredentialOffer[]} offers  array of offers
 * @param {string} credentialSubjectId  optional field if credential subject needs to be bound into the offer
 * @param {{[Name: string]: CredentialTypeMetadata}} credentialTypesMap the credential types metadata
 * @param {Issuer} issuer  the issuer
 * @param {Context} context the context
 * @returns {Promise<string[]>} Returns signed credentials for each offer in vc-jwt format
 */
const issueVeriiCredentials = async (
  offers,
  credentialSubjectId,
  credentialTypesMap,
  issuer,
  context
) => {
  const vcs = await signVeriiCredentials(
    offers,
    credentialSubjectId,
    credentialTypesMap,
    issuer,
    context
  );

  await anchorVeriiCredentials(map('metadata', vcs), issuer, context);

  return map('vcJwt', vcs);
};

/**
 * Prepares and signs verifiable credentials from local offers without anchoring them to the blockchain.
 * Assumption is that credential offers contain all required fields including @context, type, contentHash
 * @param {CredentialOffer[]} offers  array of offers
 * @param {string} credentialSubjectId  optional field if credential subject needs to be bound into the offer
 * @param {{[Name: string]: CredentialTypeMetadata}} credentialTypesMap the credential types metadata
 * @param {Issuer} issuer  the issuer
 * @param {Context} context the context
 * @returns {Promise<{vcJwt: string, metadata: CredentialMetadata}[]>} Returns array of signed vcs (in jwt format) and their metadata
 */
const signVeriiCredentials = async (
  offers,
  credentialSubjectId,
  credentialTypesMap,
  issuer,
  context
) => {
  const metadataEntries = await allocateMetadataListEntries(
    offers,
    credentialTypesMap,
    issuer,
    METADATA_LIST_SIZE,
    context
  );
  const newMetadataListEntries = getNewListEntries(metadataEntries);
  if (newMetadataListEntries.length > 0) {
    const { createList } = await initCredentialMetadataContract(
      issuer,
      context
    );
    for (const newMetadataListEntry of newMetadataListEntries) {
      // eslint-disable-next-line no-await-in-loop
      await createList(
        newMetadataListEntry.listId,
        newMetadataListEntry.algType
      );
    }
  }

  // pre-allocate list entries using internal tables/collections
  const revocationListEntries = await allocateGenericListEntries(
    offers.length,
    issuer,
    'revocationListAllocations',
    REVOCATION_LIST_SIZE,
    context
  );
  const [newRevocationListEntry] = getNewListEntries(revocationListEntries);
  if (newRevocationListEntry != null) {
    await createRevocationList(newRevocationListEntry.listId, issuer, context);
  }

  return prepareJwtVcs(
    offers,
    credentialSubjectId,
    issuer,
    metadataEntries,
    revocationListEntries,
    credentialTypesMap,
    context
  );
};

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
 * Gets the new list entry. Since the number of entries per list is 10k then only one will ever be returned
 * @param {AllocationListEntry[]} entries the entries
 * @returns {AllocationListEntry[] | undefined} returns the new list entries if they exist, otherwise empty array
 */
const getNewListEntries = (entries) =>
  entries?.filter((entry) => entry.isNewList);

module.exports = {
  anchorVeriiCredentials,
  issueVeriiCredentials,
  signVeriiCredentials,
};
