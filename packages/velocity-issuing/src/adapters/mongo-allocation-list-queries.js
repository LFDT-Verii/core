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
/** @import { Issuer, AllocationListEntry, AllocationListQueries, Context } from "../../types/types" */

const { toEthereumAddress } = require('@verii/blockchain-functions');
const { hexFromJwk } = require('@verii/jwt');
/**
 * Returns the queries needed for allocating to DLT Lists
 * @param {unknown} db the db connection
 * @returns {AllocationListQueries} queries to allocate to lists on a db
 */
const mongoAllocationListQueries = (db) => {
  /**
   * Gets the next entry out of the list
   * @param {string} entityName the name of the collection or table for the list
   * @param {Issuer} issuer the issuer
   * @param {Context} context the context
   * @returns {AllocationListEntry} the next entry of the list
   */
  const allocateNextEntry = async (entityName, issuer, context) => {
    const operatorAddress = await getOperatorAddress(issuer, context);
    const result = await db.collection(entityName).findOneAndUpdate(
      {
        tenantId: issuer.id,
        operatorAddress,
        $and: [
          { freeIndexes: { $exists: true } },
          { freeIndexes: { $not: { $size: 0 } } },
        ],
      },
      {
        $pop: { freeIndexes: -1 },
        $set: {
          updatedAt: new Date(),
        },
      },
      {
        upsert: false,
        returnNewDocument: false,
        includeResultMetadata: true,
      }
    );
    return {
      listId: result.value.currentListId,
      index: result.value.freeIndexes?.[0],
      isNewList: false,
    };
  };

  /**
   * Create a new allocation list on ledger
   * @param {string} entityName the name of the collection or table for the list
   * @param {Issuer} issuer the issuer
   * @param {number} newListId the new allocation list id
   * @param {number[]} allocations the new allocations to use
   * @param {Context} context the context
   * @returns {AllocationListEntry} the first entry of the list
   */
  const createNewAllocationList = async (
    entityName,
    issuer,
    newListId,
    allocations,
    context
  ) => {
    const operatorAddress = await getOperatorAddress(issuer, context);
    await db.collection(entityName).insertOne({
      tenantId: issuer.id,
      freeIndexes: allocations.slice(1),
      currentListId: newListId,
      operatorAddress,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      listId: newListId,
      index: allocations[0],
      isNewList: true,
    };
  };

  return {
    createNewAllocationList,
    allocateNextEntry,
  };
};

/**
 * Gets the operator address
 * @param {Issuer} issuer the issuer
 * @param {Context} context the context
 * @returns {string} the operator address
 */
const getOperatorAddress = async (issuer, { kms }) => {
  if (issuer.dltOperatorAddress != null) {
    return issuer.dltOperatorAddress;
  }

  const key = await kms.exportKeyOrSecret(issuer.dltOperatorKMSKeyId);
  return toEthereumAddress(hexFromJwk(key.privateJwk));
};

module.exports = {
  mongoAllocationListQueries,
};
