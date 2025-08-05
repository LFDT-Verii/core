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
// eslint-disable-next-line max-classes-per-file
const { after, mock, describe, it } = require('node:test');
const { expect } = require('expect');

const mockSend = mock.fn((payload) => payload);
mock.module('@aws-sdk/lib-dynamodb', {
  namedExports: {
    GetCommand: class GetCommand {
      constructor(args) {
        return args;
      }
    },
    PutCommand: class PutCommand {
      constructor(args) {
        return args;
      }
    },
    DynamoDBDocumentClient: {
      from: mock.fn(() => ({
        send: mockSend,
      })),
    },
  },
});

const {
  initReadDocument,
  initWriteDocument,
} = require('../src/document-storage');

const readDocument = initReadDocument({});
const writeDocument = initWriteDocument({});

describe('Documents Storage', () => {
  after(() => {
    mock.reset();
  });

  it('Should read document', async () => {
    await readDocument('TABLE', 'KEY');

    expect(mockSend.mock.calls.map((call) => call.arguments)).toContainEqual([
      {
        TableName: 'TABLE',
        Key: 'KEY',
      },
    ]);
  });

  it('Should write document', async () => {
    await writeDocument('TABLE', {});

    expect(mockSend.mock.calls.map((call) => call.arguments)).toContainEqual([
      {
        TableName: 'TABLE',
        Item: {},
      },
    ]);
  });
});
