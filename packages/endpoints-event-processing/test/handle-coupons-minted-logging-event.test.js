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
  events: sampleMintEventsArray,
} = require('./data/sample-mint-events-array');

const mockReadDocument = jest.fn().mockResolvedValue(undefined);
const mockWriteDocument = jest.fn().mockResolvedValue(undefined);
const mockInitReadDocument = jest.fn().mockReturnValue(mockReadDocument);
const mockInitWriteDocument = jest.fn().mockReturnValue(mockWriteDocument);
const mockLogInfo = jest.fn();
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
            return { value: sampleMintEventsArray };
          })
          .mockImplementationOnce(async () => {
            return { done: true };
          }),
      };
    },
  };
});

const mockPullMintCouponBundleEvents = jest
  .fn()
  .mockResolvedValue({ eventsCursor: mockEventCursor, latestBlock: 42 });
const mockInitVerificationCoupon = jest.fn().mockImplementation(() => {
  return {
    pullMintCouponBundleEvents: mockPullMintCouponBundleEvents,
  };
});

const { handleCouponsMintedLoggingEvent } = require('../src/handlers');

jest.mock('@verii/aws-clients', () => {
  const originalModule = jest.requireActual('@verii/aws-clients');

  return {
    ...originalModule,
    initReadDocument: mockInitReadDocument,
    initWriteDocument: mockInitWriteDocument,
  };
});

jest.mock('@verii/metadata-registration', () => {
  const originalModule = jest.requireActual(
    '@verii/metadata-registration'
  );
  return {
    ...originalModule,
    initVerificationCoupon: mockInitVerificationCoupon,
  };
});

describe('Coupons minted event logging task test suite', () => {
  const task = 'coupons-minted-logging';
  const testContext = {
    config: {
      couponContractAddress: 'TESTS',
      rpcUrl: 'TESTS',
    },
    log: {
      info: mockLogInfo,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Should successfully write log entries for a given set of events read off the blockchain', async () => {
    mockReadDocument.mockResolvedValue({
      Item: {
        EventName: task,
        BlockNumber: 1,
      },
    });

    await handleCouponsMintedLoggingEvent(testContext);

    expect(mockInitReadDocument).toHaveBeenCalledTimes(1);
    expect(mockInitWriteDocument).toHaveBeenCalledTimes(1);
    expect(mockInitVerificationCoupon).toHaveBeenCalledTimes(1);

    expect(mockReadDocument).toHaveBeenCalledTimes(1);
    expect(mockReadDocument).toHaveBeenCalledWith(
      testContext.config.dynamoDbTableEventBlock,
      { EventName: task }
    );

    expect(mockPullMintCouponBundleEvents).toHaveBeenCalledTimes(1);
    expect(mockPullMintCouponBundleEvents).toHaveBeenCalledWith(2);

    expect(mockLogInfo).toHaveBeenCalledTimes(8);
    expect(mockLogInfo).toHaveBeenNthCalledWith(6, {
      blockHash: expect.any(String),
      blockNumber: expect.any(Number),
      event: 'MintCouponBundle',
      eventTraceId: 'trackingId',
      bundleIdHex: '0x03',
      bundleId: '3',
      expirationTime: new Date(1649746690000),
      quantity: '1',
      owner: expect.any(String),
      ownerDid: expect.any(String),
      transactionHash: expect.any(String),
      transactionIndex: expect.any(Number),
    });
    expect(mockLogInfo).toHaveBeenNthCalledWith(7, {
      lastReadBlock: 1,
      numberOfEventsRead: 4,
      task: 'coupons-minted-logging',
    });

    expect(mockWriteDocument).toHaveBeenCalledTimes(1);
    expect(mockWriteDocument).toHaveBeenCalledWith(
      testContext.config.dynamoDbTableEventBlock,
      {
        EventName: task,
        BlockNumber: 42,
      }
    );
    expect(mockEventCursor).toHaveBeenCalledTimes(1);
    expect(mockEventCursorNext).toHaveBeenCalledTimes(3);
  });

  it('Should successfully handle initial case of no existing blocks', async () => {
    mockReadDocument.mockResolvedValue(undefined);

    const func = async () => handleCouponsMintedLoggingEvent(testContext);

    await expect(func()).resolves.toEqual(undefined);

    expect(mockPullMintCouponBundleEvents).toHaveBeenCalledWith(0);
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

    const func = async () => handleCouponsMintedLoggingEvent(testContext);

    await expect(func()).resolves.toEqual(undefined);

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
