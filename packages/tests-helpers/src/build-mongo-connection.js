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
const { includes } = require('lodash/fp');
const env = require('env-var');

const buildMongoConnection = (dbName) => {
  const isTlsMongo = env.get('TLS_MONGO').default('false').asBool();

  if (!isTlsMongo) {
    return `mongodb://localhost:27017/${dbName}`;
  }

  const mongoUsername = env.get('MONGO_USERNAME').default('').asString();
  const mongoPassword = env.get('MONGO_PASSWORD').default('').asString();
  const caFilename = env.get('CA_FILENAME').default('').asString();
  const testMongoBaseUri = env
    .get('TEST_MONGO_BASE_URI')
    .default('')
    .asString();

  // Uses tlsAllowInvalidHostnames to allow localhost SSH tunnleing to remote DB
  const connUri =
    testMongoBaseUri !== ''
      ? `${testMongoBaseUri}/${dbName}`
      : `mongodb://${mongoUsername}:${mongoPassword}@localhost:27017/${dbName}`;
  const directConnection = includes('mongodb+srv', testMongoBaseUri)
    ? ''
    : '&directConnection=true';
  const tlsCaFileOption = caFilename !== '' ? `&tlsCAFile=${caFilename}` : '';
  const connOptions = `tls=true${tlsCaFileOption}&tlsAllowInvalidHostnames=true&retryWrites=false${directConnection}`;

  return `${connUri}?${connOptions}`;
};

module.exports = { buildMongoConnection };
