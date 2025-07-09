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

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const nock = require('nock');
const buildFastify = require('./helpers/build-fastify');
const initCredentialSchemaFactory = require('./factories/credential-schema-factory');

describe('credential types endpoints', () => {
  let fastify;
  let persistCredentialSchema;

  beforeAll(async () => {
    fastify = buildFastify();
    await fastify.ready();
    ({ persistCredentialSchema } = initCredentialSchemaFactory(fastify));
  });

  beforeEach(async () => {
    await mongoDb().collection('credentialSchemas').deleteMany({});
    await Promise.all([
      persistCredentialSchema({
        credentialType: 'EducationDegree',
        schemaName: 'education-degree',
        schemaUrl: 'https://example.com/education-degree.schema.json',
        displayDescriptorUrls: {
          en: 'https://example.com/education-degree.display.json',
        },
      }),
      persistCredentialSchema({
        credentialType: 'OpenBadgeV1.0',
        schemaName: 'open-badge-v1.0',
        schemaUrl: 'https://example.com/open-badge-v1.0.schema.json',
        displayDescriptorUrls: {
          en: 'https://example.com/open-badge-v1.0.display.json',
        },
      }),
      persistCredentialSchema({
        credentialType: 'WeirdEducationDegree',
        schemaName: 'weird-education-degree',
        schemaUrl: 'https://example.com/weird-education-degree.schema.json',
        displayDescriptorUrls: {
          en: 'https://example.com/weird-education-degree.display.json',
        },
      }),
    ]);
  });

  afterAll(async () => {
    await fastify.close();
    nock.cleanAll();
    nock.restore();
  });

  it('should retrieve a credential descriptors and 200', async () => {
    const response = await fastify.injectJson({
      method: 'GET',
      url: '/api/v0.6/credential-type-descriptors/OpenBadgeV1.0',
    });
    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      id: 'OpenBadgeV1.0',
      name: 'Open Badge',
      schema: [
        {
          uri: 'https://example.com/open-badge-v1.0.schema.json',
        },
      ],
    });
  });

  it('should retrieve a credential descriptors including display and 200', async () => {
    const fetchNock = nock('https://example.com')
      .get('/open-badge-v1.0.display.json')
      .times(1)
      .reply(200, {
        $id: 'https://example.com/schema.json',
      });
    const response = await fastify.injectJson({
      method: 'GET',
      url: '/api/v0.6/credential-type-descriptors/OpenBadgeV1.0?includeDisplay=true',
    });
    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      id: 'OpenBadgeV1.0',
      name: 'Open Badge',
      schema: [
        {
          uri: 'https://example.com/open-badge-v1.0.schema.json',
        },
      ],
      display: {
        $id: 'https://example.com/schema.json',
      },
    });
    expect(fetchNock.isDone()).toBe(true);
  });

  it('should retrieve a credential descriptors including default english version display and 200', async () => {
    const fetchNock = nock('https://example.com')
      .get('/open-badge-v1.0.display.json')
      .times(1)
      .reply(200, {
        $id: 'https://example.com/schema.json',
      });
    const response = await fastify.injectJson({
      method: 'GET',
      url: '/api/v0.6/credential-type-descriptors/OpenBadgeV1.0?includeDisplay=true&locale=fr_CA',
    });
    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      id: 'OpenBadgeV1.0',
      name: 'Open Badge',
      schema: [
        {
          uri: 'https://example.com/open-badge-v1.0.schema.json',
        },
      ],
      display: {
        $id: 'https://example.com/schema.json',
      },
    });
    expect(fetchNock.isDone()).toBe(true);
  });

  it('should retrieve a credential descriptors without display, if manifest file doesnt exist, and 200', async () => {
    const fetchNock = nock('https://example.com')
      .get('/weird-education-degree.display.json')
      .times(1)
      .reply(400, {});
    const response = await fastify.injectJson({
      method: 'GET',
      url: '/api/v0.6/credential-type-descriptors/WeirdEducationDegree?includeDisplay=true',
    });
    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      id: 'WeirdEducationDegree',
      name: 'Weird Education Degree',
      schema: [
        {
          uri: 'https://example.com/weird-education-degree.schema.json',
        },
      ],
    });
    expect(fetchNock.isDone()).toBe(true);
  });

  it('should 404 if not found', async () => {
    const response = await fastify.injectJson({
      method: 'GET',
      url: '/api/v0.6/credential-type-descriptors/Nothing',
    });
    expect(response.statusCode).toEqual(404);
  });
});
