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

const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const {
  initReadDocument,
  initWriteDocument,
} = require('../src/document-storage');

const mockSend = jest.fn((payload) => payload);

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  ...jest.requireActual('@aws-sdk/lib-dynamodb'),
  GetCommand: jest.fn((args) => args),
  PutCommand: jest.fn((args) => args),
}));
DynamoDBDocumentClient.from = jest.fn().mockImplementation(() => ({
  send: mockSend,
}));

const readDocument = initReadDocument({});
const writeDocument = initWriteDocument({});

describe('Documents Storage', () => {
  it('Should read document', async () => {
    await readDocument('TABLE', 'KEY');

    expect(mockSend).toHaveBeenCalledWith({
      TableName: 'TABLE',
      Key: 'KEY',
    });
  });

  it('Should write document', async () => {
    await writeDocument('TABLE', {});

    expect(mockSend).toHaveBeenCalledWith({
      TableName: 'TABLE',
      Item: {},
    });
  });
});
