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
const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const nock = require('nock');
const { errorResponseMatcher } = require('@verii/tests-helpers');
const buildFastify = require('./helpers/build-fastify');
const initCredentialSchemasRepo = require('./factories/credential-schema-factory');

describe('Static display descriptor files tests suite', () => {
  let fastify;
  let persistCredentialSchema;

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();

    ({ persistCredentialSchema } = initCredentialSchemasRepo(fastify));
  });

  beforeEach(async () => {
    nock.cleanAll();
    await mongoDb().collection('credentialSchemas').deleteMany({});
  });

  after(async () => {
    await fastify.close();
    nock.cleanAll();
    nock.restore();
  });

  it('should return 404 if static file not exist ', async () => {
    const path = '/display-descriptors/badge-no-file.descriptor.json';
    const response = await fastify.injectJson({
      method: 'GET',
      url: path,
    });
    expect(response.statusCode).toEqual(404);
    expect(response.json).toStrictEqual(
      errorResponseMatcher({
        statusCode: 404,
        error: 'Not Found',
        message: 'File not found',
      }),
    );
  });

  it('should return static file', async () => {
    await persistCredentialSchema({
      credentialType: 'Badge',
      schemaName: 'badge',
      schemaUrl: 'https://example.com/badge.schema.json',
      displayDescriptorUrls: {
        en: 'https://example.com/badge.descriptor.json',
      },
      formSchemaUrls: {
        en: 'https://example.com/Badge.form.json',
      },
    });

    const fetchNock = nock('https://example.com')
      .get('/badge.descriptor.json')
      .times(1)
      .reply(200, { test: 'test' });

    const path = '/display-descriptors/en/badge.descriptor.json';
    const response = await fastify.injectJson({
      method: 'GET',
      url: path,
    });
    expect(response.statusCode).toEqual(200);
    expect(response.json).toStrictEqual({ test: 'test' });
    expect(fetchNock.isDone()).toBe(true);
  });

  it('should return static file with kebab case versioned schema', async () => {
    await persistCredentialSchema({
      credentialType: 'BadgeV1.0',
      schemaName: 'badge-v1.0',
      schemaUrl: 'https://example.com/badge-v1.0.schema.json',
      displayDescriptorUrls: {
        en: 'https://example.com/badge-v1.0.descriptor.json',
      },
      formSchemaUrls: {
        en: 'https://example.com/BadgeV1.0.form.json',
      },
    });

    const fetchNock = nock('https://example.com')
      .get('/badge-v1.0.descriptor.json')
      .times(1)
      .reply(200, { test: 'test' });

    const path = '/display-descriptors/en/badge-v1.0';
    const response = await fastify.injectJson({
      method: 'GET',
      url: path,
    });
    expect(response.statusCode).toEqual(200);
    expect(response.json).toStrictEqual({ test: 'test' });
    expect(fetchNock.isDone()).toBe(true);
  });

  it('should return static file with kebab case versioned schema', async () => {
    await persistCredentialSchema({
      credentialType: 'Badge',
      schemaName: 'badge',
      schemaUrl: 'https://example.com/badge.schema.json',
      displayDescriptorUrls: {
        en: 'https://example.com/badge.descriptor.json',
      },
      formSchemaUrls: {
        en: 'https://example.com/Badge.form.json',
      },
    });

    const fetchNock = nock('https://example.com')
      .get('/badge.descriptor.json')
      .times(1)
      .reply(200, { test: 'test' });

    const path = '/display-descriptors/en/badge';
    const response = await fastify.injectJson({
      method: 'GET',
      url: path,
    });
    expect(response.statusCode).toEqual(200);
    expect(response.json).toStrictEqual({ test: 'test' });
    expect(fetchNock.isDone()).toBe(true);
  });

  it('should return english version of file if locale not exist', async () => {
    await persistCredentialSchema({
      credentialType: 'badge',
      schemaName: 'badge',
      schemaUrl: 'https://example.com/badge.schema.json',
      displayDescriptorUrls: {
        en: 'https://example.com/badge.descriptor.json',
      },
      formSchemaUrls: {
        en: 'https://example.com/badge.form.json',
      },
    });

    const fetchNock = nock('https://example.com')
      .get('/badge.descriptor.json')
      .times(1)
      .reply(200, { test: 'test' });

    const path = '/display-descriptors/abc/badge.descriptor.json';
    const response = await fastify.injectJson({
      method: 'GET',
      url: path,
    });
    expect(response.statusCode).toEqual(200);
    expect(response.json).toStrictEqual({ test: 'test' });
    expect(fetchNock.isDone()).toBe(true);
  });
});
