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

const { burnEventsArray } = require('./data/sample-burn-events-array');

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

const { handleCouponsBurnedLoggingEvent } = require('../src/handlers');

jest.mock('@verii/aws-clients', () => {
  const originalModule = jest.requireActual('@verii/aws-clients');

  return {
    ...originalModule,
    initReadDocument: mockInitReadDocument,
    initWriteDocument: mockInitWriteDocument,
  };
});

jest.mock('@verii/metadata-registration', () => {
  const originalModule = jest.requireActual('@verii/metadata-registration');
  return {
    ...originalModule,
    initVerificationCoupon: mockInitVerificationCoupon,
  };
});

describe('Coupons burned event logging task test suite', () => {
  const task = 'coupons-burned-logging';
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

    await handleCouponsBurnedLoggingEvent(testContext);

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

    expect(mockLogInfo).toHaveBeenCalledTimes(10);
    expect(mockLogInfo).toHaveBeenNthCalledWith(8, {
      blockNumber: expect.any(Number),
      blockHash: expect.any(String),
      transactionHash: expect.any(String),
      transactionIndex: expect.any(Number),
      event: 'BurnCoupon',
      owner: expect.any(String),
      bundleId: expect.any(String),
      bundleIdHex: expect.any(String),
      eventTraceId: 'trackingId',
      caoDid: expect.any(String),
      burnerDid: expect.any(String),
      balance: 3,
      expirationTime: expect.any(Date),
      burnTime: expect.any(Date),
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

    const func = async () => handleCouponsBurnedLoggingEvent(testContext);

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

    const func = async () => handleCouponsBurnedLoggingEvent(testContext);

    await expect(func()).resolves.toEqual(undefined);

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
    expect(mockLogInfo).toHaveBeenCalledTimes(4);
  });
});
