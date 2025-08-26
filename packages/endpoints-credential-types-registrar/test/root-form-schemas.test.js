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

describe('Static form schema files tests suite', () => {
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
    const path = '/form-schemas/LicenseV1.0-no-file.form-schema.json';
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
      })
    );
  });

  it('should return static file', async () => {
    await persistCredentialSchema({
      credentialType: 'LicenseV1.0',
      schemaName: 'license-v1.0',
      schemaUrl: 'https://example.com/licenseV1.0.schema.json',
      displayDescriptorUrls: {
        en: 'https://example.com/licenseV1.0.descriptor.json',
      },
      formSchemaUrls: {
        en: 'https://example.com/LicenseV1.0.form-schema.json',
      },
    });

    const fetchNock = nock('https://example.com')
      .get('/LicenseV1.0.form-schema.json')
      .times(1)
      .reply(200, { test: 'test' });

    const path = '/form-schemas/en/LicenseV1.0.form-schema.json';
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
      credentialType: 'LicenseV1.0',
      schemaName: 'license-v1.0',
      schemaUrl: 'https://example.com/LicenseV1.0.schema.json',
      displayDescriptorUrls: {
        en: 'https://example.com/LicenseV1.0.descriptor.json',
      },
      formSchemaUrls: {
        en: 'https://example.com/LicenseV1.0.form-schema.json',
      },
    });

    const fetchNock = nock('https://example.com')
      .get('/LicenseV1.0.form-schema.json')
      .times(1)
      .reply(200, { test: 'test' });

    const path = '/form-schemas/en/license-v1.0';
    const response = await fastify.injectJson({
      method: 'GET',
      url: path,
    });
    expect(response.statusCode).toEqual(200);
    expect(response.json).toStrictEqual({ test: 'test' });
    expect(fetchNock.isDone()).toBe(true);
  });

  it('should return static file with kebab case', async () => {
    await persistCredentialSchema({
      credentialType: 'License',
      schemaName: 'license',
      schemaUrl: 'https://example.com/license.schema.json',
      displayDescriptorUrls: {
        en: 'https://example.com/license.descriptor.json',
      },
      formSchemaUrls: {
        en: 'https://example.com/License.form-schema.json',
      },
    });

    const fetchNock = nock('https://example.com')
      .get('/License.form-schema.json')
      .times(1)
      .reply(200, { test: 'test' });

    const path = '/form-schemas/en/license';
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
      credentialType: 'LicenseV1.0',
      schemaName: 'license-v1.0',
      schemaUrl: 'https://example.com/licenseV1.0.schema.json',
      displayDescriptorUrls: {
        en: 'https://example.com/licenseV1.0.descriptor.json',
      },
      formSchemaUrls: {
        en: 'https://example.com/LicenseV1.0.form-schema.json',
      },
    });

    const fetchNock = nock('https://example.com')
      .get('/LicenseV1.0.form-schema.json')
      .times(1)
      .reply(200, { test: 'test' });

    const path = '/form-schemas/abc/LicenseV1.0.form-schema.json';
    const response = await fastify.injectJson({
      method: 'GET',
      url: path,
    });
    expect(response.statusCode).toEqual(200);
    expect(response.json).toStrictEqual({ test: 'test' });
    expect(fetchNock.isDone()).toBe(true);
  });
});
