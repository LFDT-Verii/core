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

const nock = require('nock');
const { errorResponseMatcher } = require('@verii/tests-helpers');
const buildFastify = require('./helpers/build-fastify');
const initCredentialSchemaFactory = require('./factories/credential-schema-factory');

describe('Form schemas', () => {
  let fastify;
  let persistCredentialSchema;

  beforeAll(async () => {
    fastify = buildFastify();
    await fastify.ready();
    ({ persistCredentialSchema } = initCredentialSchemaFactory(fastify));
  });

  afterAll(async () => {
    await fastify.close();
    nock.cleanAll();
    nock.restore();
  });

  it('should return form schemas', async () => {
    const fetchNock = nock('https://example.com')
      .get('/emailV1.0.form-schemas.json')
      .times(1)
      .reply(200, {
        $id: 'https://example.com/schema.json',
      });

    await persistCredentialSchema({
      credentialType: 'EmailV1.0',
      schemaName: 'emailV1.0',
      formSchemaUrls: {
        en: 'https://example.com/emailV1.0.form-schemas.json',
      },
    });
    const response = await fastify.injectJson({
      method: 'GET',
      url: 'api/v0.6/form-schemas?credentialType=EmailV1.0',
    });

    expect(response.statusCode).toEqual(200);
    expect(response.headers).toMatchObject({
      'content-type': 'application/json; charset=utf-8',
    });
    expect(response.json).toEqual({
      $id: 'https://example.com/schema.json',
    });
    expect(fetchNock.isDone()).toBeTruthy();
  });

  it('should return en form schemas if locale not exists', async () => {
    const fetchNock = nock('https://example.com')
      .get('/emailV1.0.form-schemas.json')
      .times(1)
      .reply(200, {
        $id: 'https://example.com/schema.json',
      });

    await persistCredentialSchema({
      credentialType: 'EmailV1.0',
      schemaName: 'emailV1.0',
      formSchemaUrls: {
        en: 'https://example.com/emailV1.0.form-schemas.json',
      },
    });

    const response = await fastify.injectJson({
      method: 'GET',
      url: 'api/v0.6/form-schemas?credentialType=EmailV1.0&locale=fr_CA',
    });

    expect(response.statusCode).toEqual(200);
    expect(response.headers).toMatchObject({
      'content-type': 'application/json; charset=utf-8',
    });
    expect(response.json).toEqual({
      $id: 'https://example.com/schema.json',
    });
    expect(fetchNock.isDone()).toBeTruthy();
  });

  it('should return 404 if form schemas not found', async () => {
    const fetchNock = nock('https://example.com')
      .get('/emailV1.0.form-schemas.json')
      .times(1)
      .reply(200, {
        $id: 'https://example.com/schema.json',
      });
    await persistCredentialSchema({
      credentialType: 'EmailV1.0',
      schemaName: 'emailV1.0',
      formSchemaUrls: {
        en: 'https://example.com/emailV1.0.form-schemas.json',
      },
    });
    const response = await fastify.injectJson({
      method: 'GET',
      url: 'api/v0.6/form-schemas?credentialType=notFound',
    });

    expect(response.statusCode).toEqual(404);
    expect(response.headers).toMatchObject({
      'content-type': 'application/json; charset=utf-8',
    });
    expect(response.json).toEqual(
      errorResponseMatcher({
        error: 'Not Found',
        message: 'Form schemas not found',
        errorCode: 'form_schemas_not_found',
        statusCode: 404,
      })
    );
    expect(fetchNock.isDone()).toBeFalsy();
  });
});
