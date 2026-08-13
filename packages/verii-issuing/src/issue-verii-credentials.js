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
const { extractCredentialType } = require('@verii/vc-checks');
const {
  allocateGenericListEntries,
  allocateMetadataListEntries,
} = require('./allocate-list-entries');
const {
  initCredentialMetadataContract,
} = require('./adapters/init-credential-metadata-contract');
const { createRevocationList } = require('./adapters/create-revocation-list');
const { getCredentialSigningProfile } = require('./credential-signing-profile');
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
 * @param {string[]} [credentialSigningAlgorithms] explicitly resolved key algorithms
 * @returns {Promise<string[]>} Returns signed credentials for each offer in vc-jwt format
 */
const issueVeriiCredentials = async (
  offers,
  credentialSubjectId,
  credentialTypesMap,
  issuer,
  context,
  credentialSigningAlgorithms,
) => {
  const vcs = await signVeriiCredentials(
    offers,
    credentialSubjectId,
    credentialTypesMap,
    issuer,
    context,
    credentialSigningAlgorithms,
  );

  await anchorVeriiCredentials(map('metadata', vcs), issuer, context);

  return map('vcJwt', vcs);
};

/**
 * Prepares and signs verifiable credentials from local offers without anchoring them to the blockchain.
 * Assumption is that credential offers contain all required fields including '@context', type, contentHash
 * @param {CredentialOffer[]} offers  array of offers
 * @param {string} credentialSubjectId  optional field if credential subject needs to be bound into the offer
 * @param {{[Name: string]: CredentialTypeMetadata}} credentialTypesMap the credential types metadata
 * @param {Issuer} issuer  the issuer
 * @param {Context} context the context
 * @param {string[]} [credentialSigningAlgorithms] explicitly resolved key algorithms
 * @returns {Promise<{vcJwt: string, metadata: CredentialMetadata}[]>} Returns array of signed vcs (in jwt format) and their metadata
 */
const signVeriiCredentials = async (
  offers,
  credentialSubjectId,
  credentialTypesMap,
  issuer,
  context,
  credentialSigningAlgorithms,
) => {
  const resolvedCredentialSigningAlgorithms =
    resolveCredentialSigningAlgorithms(
      offers,
      credentialTypesMap,
      credentialSigningAlgorithms,
    );
  const metadataEntries = await allocateMetadataListEntries(
    offers,
    credentialTypesMap,
    issuer,
    METADATA_LIST_SIZE,
    context,
    resolvedCredentialSigningAlgorithms,
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

  return prepareJwtVcs(
    offers,
    credentialSubjectId,
    issuer,
    metadataEntries,
    revocationListEntries,
    credentialTypesMap,
    context,
    resolvedCredentialSigningAlgorithms,
  );
};

/**
 * Resolves every configured signing algorithm to the internal key vocabulary.
 * @param {CredentialOffer[]} offers array of offers
 * @param {{[Name: string]: CredentialTypeMetadata}} credentialTypesMap the credential types metadata
 * @param {string[]} [credentialSigningAlgorithms] explicitly resolved key algorithms
 * @returns {(string | undefined)[]} signing algorithms aligned with the offers
 */
const resolveCredentialSigningAlgorithms = (
  offers,
  credentialTypesMap,
  credentialSigningAlgorithms,
) =>
  offers.map((offer, index) => {
    const algorithm =
      credentialSigningAlgorithms?.[index] ??
      credentialTypesMap?.[extractCredentialType(offer)]
        ?.defaultSignatureAlgorithm;
    return algorithm == null
      ? undefined
      : getCredentialSigningProfile(algorithm).keyAlgorithm;
  });

/**
 * Anchors prepared verifiable credentials to the blockchain using their credential metadata.
 * @param {CredentialMetadata[]} credentialMetadatas array of verifiable credential metadata
 * @param {Issuer} issuer  the issuer
 * @param {Context} context the context
 */
const anchorVeriiCredentials = async (credentialMetadatas, issuer, context) => {
  const { addEntry, readEntry } = await initCredentialMetadataContract(
    issuer,
    context,
  );

  // create credential metadata entries on dlt
  await Promise.all(
    map(
      (metadata) => anchorCredentialMetadata(metadata, addEntry, readEntry),
      credentialMetadatas,
    ),
  );
};

/**
 * Anchors one credential and confirms the stored signing key when read-back is supported.
 * @param {CredentialMetadata} metadata the credential metadata to anchor
 * @param {(metadata: CredentialMetadata) => Promise<void>} addEntry the metadata anchor operation
 * @param {(metadata: CredentialMetadata) => Promise<object | undefined>} readEntry the metadata read-back operation
 */
const anchorCredentialMetadata = async (metadata, addEntry, readEntry) => {
  try {
    await addEntry(metadata);
  } catch (error) {
    if (error.errorCode != null) {
      throw error;
    }
    const reconciledKey = await retryTransientOperation(() =>
      readEntry(metadata),
    );
    if (reconciledKey == null) {
      throw error;
    }
    assertAnchoredKeyValid(reconciledKey, metadata);
    return;
  }
  await retryTransientOperation(async () => {
    const anchoredKey = await readEntry(metadata);
    assertAnchoredKeyValid(anchoredKey, metadata);
  });
};

/**
 * Rejects an anchored key that does not match the credential signature key.
 * @param {object | undefined} anchoredKey the resolved metadata verification method
 * @param {CredentialMetadata} metadata the signed credential metadata
 */
const assertAnchoredKeyValid = (anchoredKey, metadata) => {
  if (!isAnchoredKeyValid(anchoredKey, metadata)) {
    throw new Error(
      `Credential metadata read-back does not match ${metadata.credentialId}`,
    );
  }
};

/**
 * Checks the resolved verification method id and public key material.
 * @param {object | undefined} anchoredKey the resolved metadata verification method
 * @param {CredentialMetadata} metadata the signed credential metadata
 * @returns {boolean} whether supported read-back matches the signed credential
 */
const isAnchoredKeyValid = (anchoredKey, metadata) => {
  if (anchoredKey == null) {
    return true;
  }
  const idMatches =
    metadata.credentialId == null ||
    anchoredKey.id === `${metadata.credentialId}#key-1`;
  return (
    idMatches && publicKeysMatch(anchoredKey.publicKeyJwk, metadata.publicKey)
  );
};

/**
 * Compares anchored EC or RSA public JWK material with the signing key.
 * @param {object} anchoredKey the anchored public JWK
 * @param {object} signingKey the credential signing public JWK
 * @returns {boolean} whether the public key material is identical
 */
const publicKeysMatch = (anchoredKey, signingKey) => {
  if (anchoredKey?.kty !== signingKey?.kty) {
    return false;
  }
  if (anchoredKey.kty === 'EC') {
    return [
      anchoredKey.crv === signingKey.crv,
      anchoredKey.x === signingKey.x,
      anchoredKey.y === signingKey.y,
    ].every(Boolean);
  }
  return [anchoredKey.n === signingKey.n, anchoredKey.e === signingKey.e].every(
    Boolean,
  );
};

/**
 * Retries an infrastructure operation once unless it returned a domain error.
 * @template T
 * @param {() => Promise<T>} operation the asynchronous operation
 * @param {number} attempt the current attempt number
 * @returns {Promise<T>} the operation result
 */
const retryTransientOperation = async (operation, attempt = 1) => {
  try {
    return await operation();
  } catch (error) {
    if (attempt >= 2 || error.errorCode != null) {
      throw error;
    }
    return retryTransientOperation(operation, attempt + 1);
  }
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
  signVeriiCredentials,
};
