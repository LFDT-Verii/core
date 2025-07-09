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

const nock = require('nock');
const { castArray, every, includes, pick, keyBy } = require('lodash/fp');

const credentialTypeMetadata = keyBy('credentialType', [
  {
    credentialType: 'EmailV1.0',
    layer1: true,
    schemaUrl:
      'https://velocitynetwork.foundation/schemas/email-v1.0.schema.json',
  },
  {
    credentialType: 'EmploymentCurrentV1.1',
    layer1: true,
    schemaUrl:
      'https://velocitynetwork.foundation/schemas/employment-v1.1.schema.json',
    jsonldContext: [
      'https://velocitynetwork.foundation/contexts/layer1-credentials-v1.1.json',
    ],
  },
  {
    credentialType: 'EmploymentCurrentV1.0',
    layer1: true,
    schemaUrl:
      'https://velocitynetwork.foundation/schemas/employment-v1.0.schema.json',
    jsonldContext: [
      'https://velocitynetwork.foundation/contexts/layer1-credentials-v1.0.json',
    ],
  },
  {
    credentialType: 'PastEmploymentPosition',
    layer1: true,
    schemaUrl: 'http://oracle.localhost.test/schemas/PastEmploymentPosition',
    jsonldContext: [
      'https://velocitynetwork.foundation/contexts/layer1-credentials-v1.1.json',
    ],
  },
  {
    credentialType: 'EducationDegree',
    layer1: true,
    schemaUrl:
      'http://oracle.localhost.test/schemas/education-degree-v1.1.json',
    jsonldContext: [
      'https://velocitynetwork.foundation/contexts/layer1-credentials-v1.1.json',
    ],
  },
  {
    credentialType: '1EdtechCLR2.0',
    layer1: false,
    schemaUrl: 'https://imsglobal.org/schemas/clr-v2.0-schema.json',
    jsonldContext: ['https://imsglobal.org/schemas/clr-context.json'],
  },
]);

const nockCredentialTypes = (times = 2) => {
  nock('http://oracle.localhost.test')
    .get('/api/v0.6/credential-types')
    .query((query) =>
      every(
        (credentialType) =>
          includes(credentialType, Object.keys(credentialTypeMetadata)),
        castArray(query.credentialType)
      )
    )
    .times(times)
    .reply(200, (uri) => {
      const questionMarkIdx = uri.indexOf('?');
      const searchParamsString = uri.substring(questionMarkIdx);
      const query = new URLSearchParams(searchParamsString);
      return Object.values(
        pick(query.getAll('credentialType'), credentialTypeMetadata)
      );
    });
};

const freeCredentialTypesList = ['EmailV1.0', 'DrivingLicenseV1.0'];

module.exports = {
  credentialTypeMetadata,
  nockCredentialTypes,
  freeCredentialTypesList,
};
