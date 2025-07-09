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

const { mongoify } = require('@verii/tests-helpers');
const { first, omit } = require('lodash/fp');
const { ObjectId, MongoClient } = require('mongodb');
const { nanoid } = require('nanoid');
const { generateJWAKeyPair } = require('@verii/crypto');
const { toEthereumAddress } = require('@verii/blockchain-functions');
const { hexFromJwk } = require('@verii/jwt');
const {
  mongoAllocationListQueries,
} = require('../src/adapters/mongo-allocation-list-queries');
const { collectionClient } = require('./helpers/collection-client');
const { allocateListEntry } = require('../src/allocate-list-entries');

describe('dlt list allocation', () => {
  const mongoClient = new MongoClient('mongodb://localhost:27017/');
  const collectionName = 'metadataListAllocations';
  let metadataListAllocations;
  let context;
  let issuer;
  let dltOperatorKMSKeyId;

  beforeAll(async () => {
    metadataListAllocations = await collectionClient({
      mongoClient,
      name: collectionName,
      factory: allocationListFactory,
      defaultProjection: {
        _id: 1,
        currentListId: 1,
        freeIndexes: 1,
        tenantId: 1,
        operatorAddress: 1,
        updatedAt: 1,
        createdAt: 1,
      },
    });

    const keyPair = generateJWAKeyPair({
      algorithm: 'ec',
      curve: 'secp256k1',
    });
    dltOperatorKMSKeyId = nanoid();

    issuer = {
      id: nanoid(),
      dltOperatorAddress: toEthereumAddress(
        hexFromJwk(keyPair.publicKey, false)
      ),
    };

    context = {
      allocationListQueries: mongoAllocationListQueries(
        mongoClient.db('test-collections')
      ),
      kms: {
        exportKeyOrSecret: (keyId) => {
          if (keyId !== dltOperatorKMSKeyId) {
            throw new Error('KeyNotFound');
          }
          return Promise.resolve({
            privateJwk: keyPair.privateKey,
            keyId: dltOperatorKMSKeyId,
          });
        },
      },
    };
  });

  beforeEach(async () => {
    await metadataListAllocations.deleteMany({});
  });

  afterAll(async () => {
    await mongoClient.close();
  });

  describe('modifying existing list', () => {
    it('should return new index and pop index from collection', async () => {
      const dbId = await metadataListAllocations.insertOne({
        tenantId: issuer.id,
        operatorAddress: issuer.dltOperatorAddress,
      });
      const metadataListBefore = await metadataListAllocations.findById(dbId);
      const metadataListEntry = await allocateListEntry(
        issuer,
        collectionName,
        10000,
        context
      );

      const metadataListAfter = await metadataListAllocations.findById(dbId);
      expect(metadataListAfter).toEqual(
        mongoify({
          _id: dbId,
          currentListId: metadataListEntry.listId,
          freeIndexes: [],
          tenantId: issuer.id,
          operatorAddress: issuer.dltOperatorAddress,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
      expect(metadataListEntry).toEqual({
        index: first(metadataListBefore.freeIndexes),
        listId: metadataListBefore.currentListId,
        isNewList: false,
      });
    });

    it('when returning a new index should use kms for operator fallback', async () => {
      const dbId = await metadataListAllocations.insertOne({
        tenantId: issuer.id,
        operatorAddress: issuer.dltOperatorAddress,
      });
      const metadataListBefore = await metadataListAllocations.findById(dbId);
      const metadataListEntry = await allocateListEntry(
        { ...omit('dltOperatorAddress', issuer), dltOperatorKMSKeyId },
        collectionName,
        10000,
        context
      );

      const metadataListAfter = await metadataListAllocations.findById(dbId);
      expect(metadataListAfter).toEqual(
        mongoify({
          _id: dbId,
          currentListId: metadataListEntry.listId,
          freeIndexes: [],
          tenantId: issuer.id,
          operatorAddress: issuer.dltOperatorAddress,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
      expect(metadataListEntry).toEqual({
        index: first(metadataListBefore.freeIndexes),
        listId: metadataListBefore.currentListId,
        isNewList: false,
      });
    });

    it('should return new index and pop index from collection of 2 items', async () => {
      const dbId = await metadataListAllocations.insertOne({
        tenantId: issuer.id,
        operatorAddress: issuer.dltOperatorAddress,
        freeIndexes: [1, 2],
      });
      const initialList = await metadataListAllocations.findById(dbId);

      const metadataListEntry = await allocateListEntry(
        issuer,
        collectionName,
        10000,
        context
      );
      expect(metadataListEntry).toEqual({
        index: first(initialList.freeIndexes),
        listId: initialList.currentListId,
        isNewList: false,
      });

      const metadataListAfter = await metadataListAllocations.findById(dbId);

      expect(metadataListAfter).toEqual(
        mongoify({
          _id: initialList._id,
          currentListId: initialList.currentListId,
          freeIndexes: initialList.freeIndexes.slice(-1),
          tenantId: issuer.id,
          operatorAddress: issuer.dltOperatorAddress,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
    });
  });

  describe('creating new metadata lists', () => {
    it('should create a new metadata list', async () => {
      const dbId = await metadataListAllocations.insertOne({
        tenantId: nanoid(),
        operatorAddress: issuer.dltOperatorAddress,
      });

      const altMetadataList = await metadataListAllocations.findById(dbId);

      const metadataListEntry = await allocateListEntry(
        issuer,
        collectionName,
        10000,
        context
      );
      expect(metadataListEntry).toEqual({
        index: expect.any(Number),
        listId: expect.any(Number),
        isNewList: true,
      });
      expect(metadataListEntry.listId).not.toEqual(
        altMetadataList.currentListId
      );

      // new allocation list created
      const newAllocation = await metadataListAllocations
        .collection()
        .findOne({ currentListId: metadataListEntry.listId });
      expect(newAllocation).toEqual(
        mongoify({
          _id: expect.any(ObjectId),
          currentListId: expect.any(Number),
          freeIndexes: expect.any(Array),
          tenantId: issuer.id,
          operatorAddress: issuer.dltOperatorAddress,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
    });

    it('when creating a new metadata list should use kms for operator address fallback', async () => {
      const dbId = await metadataListAllocations.insertOne({
        tenantId: nanoid(),
        operatorAddress: issuer.dltOperatorAddress,
      });

      const altMetadataList = await metadataListAllocations.findById(dbId);

      const metadataListEntry = await allocateListEntry(
        { ...omit('dltOperatorAddress', issuer), dltOperatorKMSKeyId },
        collectionName,
        10000,
        context
      );
      expect(metadataListEntry).toEqual({
        index: expect.any(Number),
        listId: expect.any(Number),
        isNewList: true,
      });
      expect(metadataListEntry.listId).not.toEqual(
        altMetadataList.currentListId
      );

      // new allocation list created
      const newAllocation = await metadataListAllocations
        .collection()
        .findOne({ currentListId: metadataListEntry.listId });
      expect(newAllocation).toEqual(
        mongoify({
          _id: expect.any(ObjectId),
          currentListId: expect.any(Number),
          freeIndexes: expect.any(Array),
          tenantId: issuer.id,
          operatorAddress: issuer.dltOperatorAddress,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
    });

    it('should allocate a new list when previous one is exhausted', async () => {
      const dbId = await metadataListAllocations.insertOne({
        tenantId: issuer.id,
        operatorAddress: issuer.dltOperatorAddress,
      });
      const metadataList1Before = await metadataListAllocations.findById(dbId);

      const metadataListEntry = await allocateListEntry(
        issuer,
        collectionName,
        10000,
        context
      );
      expect(metadataListEntry).toEqual({
        index: first(metadataList1Before.freeIndexes),
        listId: metadataList1Before.currentListId,
        isNewList: false,
      });

      expect(await metadataListAllocations.findById(dbId)).toEqual(
        mongoify({
          ...metadataList1Before,
          freeIndexes: [],
          updatedAt: expect.any(Date),
        })
      );

      const metadataListEntry2 = await allocateListEntry(
        issuer,
        collectionName,
        10000,
        context
      );

      expect(metadataListEntry2).toEqual({
        index: expect.any(Number),
        listId: expect.any(Number),
        isNewList: true,
      });

      const newAllocation = await metadataListAllocations.collection().findOne({
        currentListId: metadataListEntry2.listId,
      });

      expect(newAllocation._id).toEqual(expect.any(ObjectId));
      expect(newAllocation._id).not.toEqual(dbId);
      expect(newAllocation.currentListId).not.toEqual(
        metadataList1Before.currentListId
      );
      expect(newAllocation.freeIndexes).toHaveLength(9999);
    });

    it('should allocate a new list when existing list is missing operatorAddress', async () => {
      const dbId = await metadataListAllocations.insertOne({
        tenantId: issuer.id,
      });
      const metadataList1Before = await metadataListAllocations.findById(dbId);
      const metadataListEntry = await allocateListEntry(
        issuer,
        collectionName,
        10000,
        context
      );

      expect(metadataListEntry).toEqual({
        index: expect.any(Number),
        listId: expect.any(Number),
        isNewList: true,
      });

      const metadataList1After = await metadataListAllocations.findById(dbId);

      expect(metadataList1After).toEqual(
        mongoify({
          _id: metadataList1Before._id,
          currentListId: 1,
          freeIndexes: [1],
          tenantId: issuer.id,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );

      const newAllocation = await metadataListAllocations.collection().findOne({
        currentListId: metadataListEntry.listId,
      });

      expect(newAllocation._id).toEqual(expect.any(ObjectId));
      expect(newAllocation._id).not.toEqual(dbId);
      expect(newAllocation.currentListId).not.toEqual(
        metadataList1Before.currentListId
      );
      expect(newAllocation.freeIndexes).toHaveLength(9999);
    });
  });
});

const allocationListFactory = (overrides) => ({
  currentListId: 1,
  freeIndexes: [1],
  updatedAt: new Date(),
  createdAt: new Date(),
  ...overrides,
});
