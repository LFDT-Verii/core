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

const nock = require('nock');

const nockRegistrarAppSchemaName = ({
  nockInstance,
  basePath = 'http://oracle.localhost.test',
  schemaName = 'past-employment-position',
  credentialType = 'PastEmploymentPosition',
  repeatCount = 1,
  statusCode = 200,
  responseJson,
} = {}) => {
  (nockInstance ?? nock(basePath))
    .get('/api/v0.6/credential-types')
    .query({ credentialType })
    .times(repeatCount)
    .reply(200, [
      {
        credentialType,
        schemaUrl: `http://mock.com/schemas/${schemaName}`,
      },
    ]);

  return nock('http://mock.com')
    .get(`/schemas/${schemaName}`)
    .times(repeatCount)
    .reply(
      statusCode,
      // eslint-disable-next-line import/no-dynamic-require
      responseJson ?? require(`../schemas/${schemaName}.schema.json`)
    );
};
module.exports = {
  nockRegistrarAppSchemaName,
};
