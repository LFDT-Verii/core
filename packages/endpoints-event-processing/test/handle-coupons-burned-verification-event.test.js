/*
 * Copyright 2025 Velocity Team
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

const {
  bindRepo,
  mongoDb,
  mongoFactory,
} = require('@spencejs/spence-mongo-repos');
const { ObjectId } = require('mongodb');
const { addDays } = require('date-fns/fp');

const mockReadDocument = jest.fn().mockResolvedValue(undefined);
const mockWriteDocument = jest.fn().mockResolvedValue(undefined);
const mockInitReadDocument = jest.fn().mockReturnValue(mockReadDocument);
const mockInitWriteDocument = jest.fn().mockReturnValue(mockWriteDocument);
const mockBatchOperations = jest.fn().mockResolvedValue([]);
const mockEventCursorNext = jest.fn();
const mockEventCursor = jest.fn().mockImplementation(() => {
  return {
    [Symbol.asyncIterator]: () => {
      return {
        next: mockEventCursorNext
          .mockImplementationOnce(async () => {
            return { value: [] };
          })
          .mockImplementationOnce(async () => {
            return { value: burnEventsArray };
          })
          .mockImplementationOnce(async () => {
            return { done: true };
          }),
      };
    },
  };
});
const mockPullBurnCouponEvents = jest
  .fn()
  .mockResolvedValue({ eventsCursor: mockEventCursor, latestBlock: 42 });

const mockInitVerificationCoupon = jest.fn().mockImplementation(() => {
  return {
    pullBurnCouponEvents: mockPullBurnCouponEvents,
  };
});
const { mongoify, mongoCloseWrapper } = require('@verii/tests-helpers');
// eslint-disable-next-line max-len
const initOrganizationFactory = require('@verii/endpoints-organizations-registrar/src/entities/organizations/factories/organizations-factory');
const organizationsRepoPlugin = require('@verii/endpoints-organizations-registrar/src/entities/organizations/repos/repo');
const initPurchaseFactory = require('./factories/purchases-factory');
const purchaseRepoPlugin = require('../src/entities/purchases/repo');
const { burnEventsArray } = require('./data/sample-burn-events-array');
const burnedCouponsRepoPlugin = require('../src/entities/burned-coupons/repo');
const { handleCouponsBurnedVerificationEvent } = require('../src/handlers');

jest.mock('@verii/aws-clients', () => {
  const originalModule = jest.requireActual('@verii/aws-clients');

  return {
    ...originalModule,
    initReadDocument: mockInitReadDocument,
    initWriteDocument: mockInitWriteDocument,
  };
});

jest.mock('@verii/fineract-client', () => {
  const originalModule = jest.requireActual('@verii/fineract-client');
  return {
    ...originalModule,
    batchOperations: mockBatchOperations,
  };
});

jest.mock('@verii/metadata-registration', () => {
  const originalModule = jest.requireActual('@verii/metadata-registration');
  return {
    ...originalModule,
    initVerificationCoupon: mockInitVerificationCoupon,
  };
});

describe('Coupons burned event verification task test suite', () => {
  const task = 'coupons-burned-verification';
  const config = {
    mongoConnection: 'mongodb://localhost:27017/oracle',
    nodeEnv: 'test',
    rootPrivateKey:
      '071d76d6395c725960f2f6343bd26cc56173679b3ae33292d99d7abc289832bf',
  };
  const testContext = { config, log: console };

  let persistOrganization;
  let newOrganization;
  let persistPurchase;
  let purchaseRepo;
  let burnedCouponsRepo;
  let organizations;

  beforeAll(async () => {
    await mongoFactory(testContext);
    organizationsRepoPlugin(testContext);
    purchaseRepo = purchaseRepoPlugin(testContext);
    burnedCouponsRepo = burnedCouponsRepoPlugin(testContext);

    testContext.repos = bindRepo(testContext);

    ({ persistOrganization, newOrganization } =
      initOrganizationFactory(testContext));
    ({ persistPurchase } = initPurchaseFactory(testContext));
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await mongoDb().collection('organizations').deleteMany({});
    await mongoDb().collection('purchases').deleteMany({});
    await mongoDb().collection('burnedCoupons').deleteMany({});

    const org = await newOrganization();
    organizations = await Promise.all([
      persistOrganization(),
      persistOrganization({
        ...org,
        didDoc: {
          ...org.didDoc,
          id: 'did:velocity:0xd4df29726d500f9b85bc6c7f1b3c021f16305692',
        },
      }),
      persistOrganization({
        ...org,
        didDoc: {
          ...org.didDoc,
          id: 'did:velocity:123',
          alsoKnownAs: ['did:aka:fo.o'],
        },
        ids: {
          ...org.ids,
          tokenAccountId: '11',
        },
      }),
    ]);

    mockBatchOperations.mockResolvedValue([
      {
        statusCode: 200,
        body: '{}',
      },
      {
        statusCode: 200,
        body: '{}',
      },
      {
        statusCode: 200,
        body: '{}',
      },
      {
        statusCode: 200,
        body: '{}',
      },
    ]);
  });

  afterAll(async () => {
    await mongoCloseWrapper();
  });

  it('Should successfully sync burns for a given set of events read off the blockchain', async () => {
    const now = new Date();
    await persistPurchase({
      organization: organizations[2],
      couponBundle: {
        couponBundleId: '0x03',
        symbol: 'VVO',
        quantity: 100,
        used: 0,
        expiry: addDays(1, now),
        at: now,
        updatedAt: now,
      },
    });
    await persistPurchase({
      organization: organizations[2],
      couponBundle: {
        couponBundleId: '0x04',
        symbol: 'VVO',
        quantity: 100,
        used: 0,
        expiry: addDays(3, now),
        at: now,
        updatedAt: now,
      },
    });
    mockReadDocument.mockResolvedValue({
      Item: {
        EventName: task,
        BlockNumber: 1,
      },
    });

    const func = async () => handleCouponsBurnedVerificationEvent(testContext);

    await expect(func()).resolves.toEqual(undefined);
    expect(mockInitReadDocument).toHaveBeenCalledTimes(1);
    expect(mockInitWriteDocument).toHaveBeenCalledTimes(1);
    expect(mockInitVerificationCoupon).toHaveBeenCalledTimes(1);

    expect(mockReadDocument).toHaveBeenCalledTimes(1);
    expect(mockReadDocument).toHaveBeenCalledWith(
      testContext.config.dynamoDbTableEventBlock,
      { EventName: task }
    );

    expect(mockPullBurnCouponEvents).toHaveBeenCalledTimes(1);
    expect(mockPullBurnCouponEvents).toHaveBeenCalledWith(2);

    expect(mockBatchOperations).toHaveBeenCalledTimes(1);
    expect(mockBatchOperations).toHaveBeenCalledWith(
      {
        clientVoucherBurns: [
          clientVoucherBurnsExpectation(),
          clientVoucherBurnsExpectation(),
          clientVoucherBurnsExpectation(),
          clientVoucherBurnsExpectation(),
        ],
        transactionalBatch: false,
      },
      testContext
    );
    expect(mockWriteDocument).toHaveBeenCalledTimes(1);
    expect(mockWriteDocument).toHaveBeenCalledWith(
      testContext.config.dynamoDbTableEventBlock,
      {
        EventName: task,
        BlockNumber: 42,
      }
    );

    const purchases = await purchaseRepo(testContext).find({
      sort: [['couponBundle.couponBundleId', 'ASC']],
    });
    const burnedCoupons = await burnedCouponsRepo(testContext).find({
      sort: [['at', 'ASC']],
    });

    expect(purchases[0]).toMatchObject({
      couponBundle: {
        couponBundleId: '0x03',
        used: 1,
      },
    });
    expect(purchases[1]).toMatchObject({
      couponBundle: {
        couponBundleId: '0x04',
        used: 1,
      },
    });
    expect(burnedCoupons).toEqual([
      {
        _id: expect.any(ObjectId),
        purchaseId: purchases[0].purchaseId,
        used: 1,
        clientId: mongoify(organizations[2]).ids.brokerClientId,
        at: expect.any(Date),
      },
      {
        _id: expect.any(ObjectId),
        purchaseId: purchases[1].purchaseId,
        used: 1,
        clientId: mongoify(organizations[2]).ids.brokerClientId,
        at: expect.any(Date),
      },
    ]);
  });

  it('Should successfully sync burns and log out failures of batch call to fineract', async () => {
    mockReadDocument.mockResolvedValue({
      Item: {
        EventName: task,
        BlockNumber: 1,
      },
    });
    mockBatchOperations.mockResolvedValue([
      {
        statusCode: 400,
        body: 'foo error',
      },
      {
        statusCode: 400,
        body: 'foo error',
      },
      {
        statusCode: 400,
        body: 'foo error',
      },
      {
        statusCode: 400,
        body: 'foo error',
      },
    ]);

    const func = async () => handleCouponsBurnedVerificationEvent(testContext);

    await expect(func()).resolves.toEqual(undefined);

    expect(mockBatchOperations).toHaveBeenCalledTimes(1);
    expect(mockBatchOperations).toHaveBeenCalledWith(
      {
        clientVoucherBurns: [
          clientVoucherBurnsExpectation(),
          clientVoucherBurnsExpectation(),
          clientVoucherBurnsExpectation(),
          clientVoucherBurnsExpectation(),
        ],
        transactionalBatch: false,
      },
      testContext
    );
    expect(mockWriteDocument).toHaveBeenCalledTimes(1);
    expect(mockWriteDocument).toHaveBeenCalledWith(
      testContext.config.dynamoDbTableEventBlock,
      {
        EventName: task,
        BlockNumber: 42,
      }
    );
  });

  it('Should not update purchase without balance', async () => {
    const now = new Date();
    await persistPurchase({
      organization: organizations[2],
      couponBundle: {
        couponBundleId: new ObjectId(),
        symbol: 'VVO',
        quantity: 0,
        used: 0,
        expiry: addDays(1, now),
        at: now,
        updatedAt: now,
      },
    });
    mockReadDocument.mockResolvedValue({
      Item: {
        EventName: task,
        BlockNumber: 1,
      },
    });

    await handleCouponsBurnedVerificationEvent(testContext);

    const purchases = await purchaseRepo(testContext).find({});
    const burnedCoupons = await burnedCouponsRepo(testContext).find({});

    expect(purchases[0]).toMatchObject({
      couponBundle: {
        used: 0,
      },
    });
    expect(burnedCoupons.length).toBe(0);
  });

  it('Should correctly update used from purchase', async () => {
    const now = new Date();
    await persistPurchase({
      organization: organizations[2],
      couponBundle: {
        couponBundleId: '0x03',
        symbol: 'VVO',
        quantity: 100,
        used: 10,
        expiry: addDays(1, now),
        at: now,
        updatedAt: now,
      },
    });
    mockReadDocument.mockResolvedValue({
      Item: {
        EventName: task,
        BlockNumber: 1,
      },
    });

    await handleCouponsBurnedVerificationEvent(testContext);

    const purchase = await purchaseRepo(testContext).findOne({
      filter: {
        'couponBundle.couponBundleId': '0x03',
      },
    });
    const burnedCoupons = await burnedCouponsRepo(testContext).find({});

    expect(purchase).toMatchObject({
      couponBundle: {
        couponBundleId: '0x03',
        used: 11,
      },
    });
    expect(burnedCoupons).toEqual([
      {
        _id: expect.any(ObjectId),
        purchaseId: purchase.purchaseId,
        used: 1,
        clientId: purchase.clientId,
        at: expect.any(Date),
      },
    ]);
  });

  it('Should successfully handle initial case of no existing blocks', async () => {
    mockReadDocument.mockResolvedValue(undefined);

    const func = async () => handleCouponsBurnedVerificationEvent(testContext);

    await expect(func()).resolves.toEqual(undefined);

    expect(mockPullBurnCouponEvents).toHaveBeenCalledWith(0);
  });

  it('Should still update block when there are no events to process', async () => {
    mockEventCursor.mockImplementation(() => {
      return {
        [Symbol.asyncIterator]: () => {
          return {
            next: mockEventCursorNext
              .mockImplementationOnce(async () => {
                return { value: [] };
              })
              .mockImplementationOnce(async () => {
                return { value: [] };
              })
              .mockImplementationOnce(async () => {
                return { done: true };
              }),
          };
        },
      };
    });

    const func = async () => handleCouponsBurnedVerificationEvent(testContext);

    await expect(func()).resolves.toEqual(undefined);

    expect(mockBatchOperations).toHaveBeenCalledTimes(0);
    expect(mockWriteDocument).toHaveBeenCalledTimes(1);
    expect(mockWriteDocument).toHaveBeenCalledWith(
      testContext.config.dynamoDbTableEventBlock,
      {
        EventName: task,
        BlockNumber: 42,
      }
    );
  });
});

const clientVoucherBurnsExpectation = () => {
  return {
    quantity: 1,
    clientId: '1',
    submittedOnDate: expect.any(Date),
  };
};
