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
const { after, before, beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');

const mockReadDocument = mock.fn();
const mockWriteDocument = mock.fn();
const mockBatchOperations = mock.fn(() =>
  Promise.resolve([
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
  ]),
);
const eventsWrapper = { events: [] };
const mockEventCursor = mock.fn(() => ({
  [Symbol.asyncIterator]: () => ({
    index: -1,
    next() {
      this.index += 1;
      return eventsWrapper.events[this.index];
    },
  }),
}));
const mockInitVerificationCoupon = mock.fn(() => ({
  pullBurnCouponEvents: () =>
    Promise.resolve({ eventsCursor: mockEventCursor, latestBlock: 42 }),
}));

mock.module('@verii/aws-clients', {
  namedExports: {
    initReadDocument: () => mockReadDocument,
    initWriteDocument: () => mockWriteDocument,
  },
});

mock.module('@verii/fineract-client', {
  namedExports: {
    batchOperations: mockBatchOperations,
  },
});

mock.module('@verii/metadata-registration', {
  namedExports: {
    initVerificationCoupon: mockInitVerificationCoupon,
  },
});

const {
  bindRepo,
  mongoDb,
  mongoFactory,
} = require('@spencejs/spence-mongo-repos');
const { ObjectId } = require('mongodb');
const { addDays } = require('date-fns/fp');
const { mongoify, mongoCloseWrapper } = require('@verii/tests-helpers');
const initOrganizationFactory = require('@verii/endpoints-organizations-registrar/src/entities/organizations/factories/organizations-factory');
const organizationsRepoPlugin = require('@verii/endpoints-organizations-registrar/src/entities/organizations/repos/repo');
const initPurchaseFactory = require('./factories/purchases-factory');
const purchaseRepoPlugin = require('../src/entities/purchases/repo');
const { burnEventsArray } = require('./data/sample-burn-events-array');
const burnedCouponsRepoPlugin = require('../src/entities/burned-coupons/repo');
const { handleCouponsBurnedVerificationEvent } = require('../src/handlers');

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

  before(async () => {
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
    eventsWrapper.events = [
      { value: [] },
      { value: burnEventsArray },
      { done: true },
    ];
    mockInitVerificationCoupon.mock.resetCalls();
    mockReadDocument.mock.resetCalls();
    mockWriteDocument.mock.resetCalls();
    mockBatchOperations.mock.resetCalls();
    mockEventCursor.mock.resetCalls();

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
  });

  after(async () => {
    await mongoCloseWrapper();
    mock.reset();
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
    mockReadDocument.mock.mockImplementationOnce(() =>
      Promise.resolve({
        Item: {
          EventName: task,
          BlockNumber: 1,
        },
      }),
    );

    const func = async () => handleCouponsBurnedVerificationEvent(testContext);

    await expect(func()).resolves.toEqual(undefined);
    expect(mockInitVerificationCoupon.mock.callCount()).toEqual(1);

    expect(mockReadDocument.mock.callCount()).toEqual(1);
    expect(
      mockReadDocument.mock.calls.map((call) => call.arguments),
    ).toContainEqual([
      testContext.config.dynamoDbTableEventBlock,
      { EventName: task },
    ]);

    expect(mockBatchOperations.mock.callCount()).toEqual(1);
    expect(
      mockBatchOperations.mock.calls.map((call) => call.arguments),
    ).toContainEqual([
      {
        clientVoucherBurns: [
          clientVoucherBurnsExpectation(),
          clientVoucherBurnsExpectation(),
          clientVoucherBurnsExpectation(),
          clientVoucherBurnsExpectation(),
        ],
        transactionalBatch: false,
      },
      testContext,
    ]);
    expect(mockWriteDocument.mock.callCount()).toEqual(1);
    expect(
      mockWriteDocument.mock.calls.map((call) => call.arguments),
    ).toContainEqual([
      testContext.config.dynamoDbTableEventBlock,
      {
        EventName: task,
        BlockNumber: 42,
      },
    ]);

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
    mockReadDocument.mock.mockImplementationOnce(() =>
      Promise.resolve({
        Item: {
          EventName: task,
          BlockNumber: 1,
        },
      }),
    );
    mockBatchOperations.mock.mockImplementationOnce(() =>
      Promise.resolve([
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
      ]),
    );

    const func = async () => handleCouponsBurnedVerificationEvent(testContext);

    await expect(func()).resolves.toEqual(undefined);

    expect(mockBatchOperations.mock.callCount()).toEqual(1);
    expect(
      mockBatchOperations.mock.calls.map((call) => call.arguments),
    ).toContainEqual([
      {
        clientVoucherBurns: [
          clientVoucherBurnsExpectation(),
          clientVoucherBurnsExpectation(),
          clientVoucherBurnsExpectation(),
          clientVoucherBurnsExpectation(),
        ],
        transactionalBatch: false,
      },
      testContext,
    ]);
    expect(mockWriteDocument.mock.callCount()).toEqual(1);
    expect(
      mockWriteDocument.mock.calls.map((call) => call.arguments),
    ).toContainEqual([
      testContext.config.dynamoDbTableEventBlock,
      {
        EventName: task,
        BlockNumber: 42,
      },
    ]);
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
    mockReadDocument.mock.mockImplementationOnce(() =>
      Promise.resolve({
        Item: {
          EventName: task,
          BlockNumber: 1,
        },
      }),
    );

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
    mockReadDocument.mock.mockImplementation(() =>
      Promise.resolve({
        Item: {
          EventName: task,
          BlockNumber: 1,
        },
      }),
    );

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
    mockReadDocument.mock.mockImplementationOnce(() =>
      Promise.resolve(undefined),
    );

    const func = async () => handleCouponsBurnedVerificationEvent(testContext);

    await expect(func()).resolves.toEqual(undefined);
  });

  it('Should still update block when there are no events to process', async () => {
    eventsWrapper.events = [{ value: [] }, { value: [] }, { done: true }];

    const func = async () => handleCouponsBurnedVerificationEvent(testContext);

    await expect(func()).resolves.toEqual(undefined);

    expect(mockBatchOperations.mock.callCount()).toEqual(0);
    expect(mockWriteDocument.mock.callCount()).toEqual(1);
    expect(
      mockWriteDocument.mock.calls.map((call) => call.arguments),
    ).toContainEqual([
      testContext.config.dynamoDbTableEventBlock,
      {
        EventName: task,
        BlockNumber: 42,
      },
    ]);
  });
});

const clientVoucherBurnsExpectation = () => {
  return {
    quantity: 1,
    clientId: '1',
    submittedOnDate: expect.any(Date),
  };
};
