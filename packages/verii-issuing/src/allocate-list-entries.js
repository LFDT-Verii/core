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

/** @import { Context, CredentialOffer, CredentialTypeMetadata, Issuer, AllocationListEntry, AllocationListQueries } from "../../types/types" */

const { extractCredentialType } = require('@verii/vc-checks');
const { ALG_TYPE } = require('@verii/metadata-registration');
const { allocateArray } = require('./utils/allocate-array');
const { generateListIndex } = require('./utils/generate-list-index');
const { calcAlgTypeName } = require('./utils/calc-alg-type-name');
/**
 * Allocates list entries
 * @param {number} total the number of entries required (typically the number of offers)
 * @param {Issuer}  issuer the issuer
 * @param {string} entityName the entity name
 * @param {number} listSize the list size
 * @param {Context} context the context
 * @returns {Promise<AllocationListEntry[]>} the allocated entries
 */
const allocateGenericListEntries = async (
  total,
  issuer,
  entityName,
  listSize,
  context
) => {
  const entries = [];
  for (let i = 0; i < total; i += 1) {
    entries.push(
      // eslint-disable-next-line no-await-in-loop
      await allocateListEntry(issuer, entityName, listSize, context)
    );
  }
  return entries;
};

/**
 * Generates metadata list entries. Different lists for each different algorithm used.
 * @param {CredentialOffer[]} offers  array of offers
 * @param {{[Name: string]: CredentialTypeMetadata}} credentialTypesMap the credential types
 * @param {Issuer}  issuer the issuer
 * @param {number} listSize the list size
 * @param {Context} context the context
 * @returns {Promise<AllocationListEntry[]>} the allocated entries
 */
const allocateMetadataListEntries = async (
  offers,
  credentialTypesMap,
  issuer,
  listSize,
  context
) => {
  const entries = [];
  for (let i = 0; i < offers.length; i += 1) {
    const algTypeName = calcAlgTypeName(
      credentialTypesMap?.[extractCredentialType(offers[i])]
    );
    entries.push({
      algType: ALG_TYPE[algTypeName],
      // eslint-disable-next-line no-await-in-loop
      ...(await allocateListEntry(
        issuer,
        `${algTypeName}_MetadataListAllocations`,
        listSize,
        context
      )),
    });
  }
  return entries;
};

/**
 * Gets the next list entry
 * @param {Issuer} issuer the issuer
 * @param {string} entityName the entity name
 * @param {number} listSize the list size
 * @param {Context} context the context
 * @returns {Promise<AllocationListEntry>} the entry
 */
const allocateListEntry = async (issuer, entityName, listSize, context) => {
  const { allocationListQueries: queries } = context;
  try {
    return await queries.allocateNextEntry(entityName, issuer, context);
  } catch (error) {
    const allocations = allocateArray(listSize);
    const newListId = generateListIndex();
    return queries.createNewAllocationList(
      entityName,
      issuer,
      newListId,
      allocations,
      context
    );
  }
};

module.exports = {
  allocateGenericListEntries,
  allocateMetadataListEntries,
  allocateListEntry,
};
