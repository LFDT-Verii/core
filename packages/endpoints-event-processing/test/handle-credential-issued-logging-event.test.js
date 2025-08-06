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
const { beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');

const mockReadDocument = mock.fn();
const mockWriteDocument = mock.fn();
const mockLogInfo = mock.fn();
const eventsWrapper = { events: [] };

const mockEventCursor = mock.fn(() => ({
  [Symbol.asyncIterator]() {
    return {
      index: -1,
      next() {
        this.index += 1;
        return eventsWrapper.events[this.index];
      },
    };
  },
}));
const mockInitMetadataRegistry = mock.fn(() => ({
  pullAddedCredentialMetadataEvents: () =>
    Promise.resolve({ eventsCursor: mockEventCursor, latestBlock: 42 }),
}));

mock.module('@verii/aws-clients', {
  namedExports: {
    initReadDocument: () => mockReadDocument,
    initWriteDocument: () => mockWriteDocument,
  },
});

mock.module('@verii/metadata-registration', {
  namedExports: {
    initMetadataRegistry: mockInitMetadataRegistry,
  },
});

const { after } = require('lodash/function');
const {
  events: sampleCredentialEventsArray,
} = require('./data/sample-credential-events-array');
const { handleCredentialIssuedLoggingEvent } = require('../src/handlers');

describe('Credential issued event logging task test suite', () => {
  const task = 'credential-issued-logging';
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
    eventsWrapper.events = [
      { value: [] },
      { value: sampleCredentialEventsArray },
      { done: true },
    ];
    mockInitMetadataRegistry.mock.resetCalls();
    mockReadDocument.mock.resetCalls();
    mockWriteDocument.mock.resetCalls();
    mockLogInfo.mock.resetCalls();
    mockEventCursor.mock.resetCalls();
  });

  after(() => {
    mock.reset();
  });

  it('Should successfully write log entries for a given set of events read off the blockchain', async () => {
    mockReadDocument.mock.mockImplementationOnce(() =>
      Promise.resolve({
        Item: {
          EventName: task,
          BlockNumber: 1,
        },
      })
    );

    await handleCredentialIssuedLoggingEvent(testContext);

    expect(mockInitMetadataRegistry.mock.callCount()).toEqual(1);

    expect(mockReadDocument.mock.callCount()).toEqual(1);
    expect(
      mockReadDocument.mock.calls.map((call) => call.arguments)
    ).toContainEqual([
      testContext.config.dynamoDbTableEventBlock,
      { EventName: task },
    ]);

    expect(mockLogInfo.mock.callCount()).toEqual(12);
    expect(mockLogInfo.mock.calls[8].arguments[0]).toEqual({
      blockHash: expect.any(String),
      blockNumber: expect.any(Number),
      caoDid: expect.any(String),
      credentialType: expect.any(String),
      event: 'AddedCredentialMetadata',
      eventTraceId: 'trackingId',
      index: '2342',
      issuerDid: expect.any(String),
      listId: '123',
      sender: expect.any(String),
      transactionHash: expect.any(String),
      transactionIndex: 0,
    });

    expect(mockWriteDocument.mock.callCount()).toEqual(1);
    expect(
      mockWriteDocument.mock.calls.map((call) => call.arguments)
    ).toContainEqual([
      testContext.config.dynamoDbTableEventBlock,
      {
        EventName: task,
        BlockNumber: 42,
      },
    ]);
    expect(mockEventCursor.mock.callCount()).toEqual(1);
  });

  it('Should successfully handle initial case of no existing blocks', async () => {
    mockReadDocument.mock.mockImplementationOnce(() =>
      Promise.resolve(undefined)
    );

    const func = async () => handleCredentialIssuedLoggingEvent(testContext);

    await expect(func()).resolves.toEqual(undefined);
  });

  it('Should still update block when there are no events to process', async () => {
    eventsWrapper.events = [{ value: [] }, { value: [] }, { done: true }];

    const func = async () => handleCredentialIssuedLoggingEvent(testContext);

    await expect(func()).resolves.toEqual(undefined);

    expect(mockWriteDocument.mock.callCount()).toEqual(1);
    expect(
      mockWriteDocument.mock.calls.map((call) => call.arguments)
    ).toContainEqual([
      testContext.config.dynamoDbTableEventBlock,
      {
        EventName: task,
        BlockNumber: 42,
      },
    ]);
    expect(mockLogInfo.mock.callCount()).toEqual(4);
  });
});
