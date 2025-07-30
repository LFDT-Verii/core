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

const { filter, flow, map } = require('lodash/fp');
const { allocateListEntries } = require('./allocate-list-entries');
const {
  initCredentialMetadataContract,
} = require('./adapters/init-credential-metadata-contract');
const { createRevocationList } = require('./adapters/create-revocation-list');
const {
  buildVerifiableCredentials,
} = require('./domain/build-verifiable-credentials');

const REVOCATION_LIST_SIZE = 10240;
const METADATA_LIST_SIZE = 10000;

/** @import { Issuer, AllocationListEntry, VelocityOffer, CredentialMetadata, CredentialTypeMetadata, Context } from "../types/types" */

/**
 * Prepares verifiable credentials from local offers without anchoring them to the blockchain.
 * Current assumption is that offers contain all required fields including @context, type, contentHash
 * @param {VelocityOffer[]} offers  array of offers
 * @param {string} credentialSubjectId  optional field if credential subject needs to be bound into the offer
 * @param {{[Name: string]: CredentialTypeMetadata}} credentialTypesMap the credential types metadata
 * @param {Issuer} issuer  the issuer
 * @param {Context} context the context
 * @returns {Promise<{vcs: object[], revocationListEntries: object[]}>} Returns prepared credentials and revocation list entries
 */
const prepareVelocityVerifiableCredentials = async (
    offers,
    credentialSubjectId,
    credentialTypesMap,
    issuer,
    context
) => {
  // pre-allocate list entries using internal tables/collections
  const revocationListEntries = await allocateListEntries(
      offers.length,
      issuer,
      'revocationListAllocations',
      REVOCATION_LIST_SIZE,
      context
  );

  const metadataEntries = await allocateListEntries(
      offers.length,
      issuer,
      'metadataListAllocations',
      METADATA_LIST_SIZE,
      context
  );

  // build credential and metadata
  const vcs = await buildVerifiableCredentials(
      offers,
      credentialSubjectId,
      issuer,
      metadataEntries,
      revocationListEntries,
      credentialTypesMap,
      context
  );

  return { vcs, revocationListEntries };
};

/**
 * Anchors prepared verifiable credentials to the blockchain.
 * @param {object[]} vcs  array of verifiable credentials
 * @param {object[]} revocationListEntries  array of revocation list entries
 * @param {Issuer} issuer  the issuer
 * @param {Context} context the context
 * @returns {Promise<string[]>} Returns signed credentials for each offer in vc-jwt format
 */
const anchorVelocityVerifiableCredentials = async (
    vcs,
    revocationListEntries,
    issuer,
    context
) => {
  // create any necessary revocation lists on dlt
  await Promise.all(
      flow(
          filter({ isNewList: true }),
          map((entry) => createRevocationList(entry.listId, issuer, context))
      )(revocationListEntries)
  );

  const { addEntry, createList } = await initCredentialMetadataContract(
      issuer,
      context
  );

  // create any necessary metadata lists on dlt
  await Promise.all(
      flow(
          filter({ metadata: { isNewList: true } }),
          map(({ metadata: { listId } }) => createList(listId, issuer, context))
      )(vcs)
  );

  // create credential metadata entries on dlt
  await Promise.all(map(({ metadata }) => addEntry(metadata), vcs));

  return map('vcJwt', vcs);
};

/**
 * Creates verifiable credential from a local offer and anchors them to the blockchain.
 * Current assumption is that offers contain all required fields including @context, type, contentHash
 * @param {VelocityOffer[]} offers  array of offers
 * @param {string} credentialSubjectId  optional field if credential subject needs to be bound into the offer
 * @param {{[Name: string]: CredentialTypeMetadata}} credentialTypesMap the credential types metadata
 * @param {Issuer} issuer  the issuer
 * @param {Context} context the context
 * @returns {Promise<string[]>} Returns signed credentials for each offer in vc-jwt format
 */
const issueVelocityVerifiableCredentials = async (
    offers,
    credentialSubjectId,
    credentialTypesMap,
    issuer,
    context
) => {
  const { vcs, revocationListEntries } =
      await prepareVelocityVerifiableCredentials(
          offers,
          credentialSubjectId,
          credentialTypesMap,
          issuer,
          context
      );

  return anchorVelocityVerifiableCredentials(
      vcs,
      revocationListEntries,
      issuer,
      context
  );
};

module.exports = {
  issueVelocityVerifiableCredentials,
  prepareVelocityVerifiableCredentials,
  anchorVelocityVerifiableCredentials,
};
