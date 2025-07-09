/**
 * Copyright 2023 Velocity Team
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
 */

const { DynamoDB } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} = require('@aws-sdk/lib-dynamodb');
const { buildClientConfig } = require('./client-config');

const createDynamoDbDocumentClient = ({ awsRegion, awsEndpoint }) =>
  DynamoDBDocumentClient.from(
    new DynamoDB(
      buildClientConfig({
        apiVersion: '2012-08-10',
        awsRegion,
        awsEndpoint,
      })
    )
  );

const initReadDocument =
  ({ awsRegion, awsEndpoint }) =>
  async (table, key) => {
    const dynamoDbDocClient = createDynamoDbDocumentClient({
      awsRegion,
      awsEndpoint,
    });

    return dynamoDbDocClient.send(
      new GetCommand({
        TableName: table,
        Key: key,
      })
    );
  };

const initWriteDocument =
  ({ awsRegion, awsEndpoint }) =>
  async (table, document) => {
    const dynamoDbDocClient = createDynamoDbDocumentClient({
      awsRegion,
      awsEndpoint,
    });

    await dynamoDbDocClient.send(
      new PutCommand({
        TableName: table,
        Item: document,
      })
    );
  };

module.exports = {
  initReadDocument,
  initWriteDocument,
};
