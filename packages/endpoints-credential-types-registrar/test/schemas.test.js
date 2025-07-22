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
const { errorResponseMatcher } = require('@verii/tests-helpers');
const { applyOverrides } = require('@verii/common-functions');
const { sampleEducationDegreeGraduation } = require('@verii/sample-data');
const buildFastify = require('./helpers/build-fastify');
const initCredentialSchemasRepo = require('./factories/credential-schema-factory');
const educationDegreeSchema = require('../../../samples/sample-lib-app/schemas/education-degree-graduation-v1.1.schema.json');

describe('Schema Management', () => {
  let fastify;
  let persistCredentialSchema;

  beforeAll(async () => {
    fastify = buildFastify();
    await fastify.ready();
    ({ persistCredentialSchema } = initCredentialSchemasRepo(fastify));
  });

  beforeEach(async () => {
    await mongoDb().collection('credentialSchemas').deleteMany({});
    nock.cleanAll();
  });

  afterAll(async () => {
    await mongoDb().collection('credentialSchemas').deleteMany({});
    await fastify.close();
    nock.cleanAll();
    nock.restore();
  });

  describe('Schema URL Retrieval', () => {
    beforeEach(async () => {
      await mongoDb().collection('credentialSchemas').deleteMany({});
      await persistCredentialSchema({
        schemaUrl: 'https://example.com/schema.json',
        displayDescriptorUrls: {
          en: 'https://example.com/display.json',
        },
        formSchemaUrls: {
          en: 'https://example.com/form.json',
        },
      });
      await persistCredentialSchema({
        schemaName: 'course',
        credentialType: 'Course',
        schemaUrl: 'https://example.com/course.schema.json',
        displayDescriptorUrls: {
          en: 'https://example.com/course.schema.json',
        },
        formSchemaUrls: {
          en: 'https://example.com/course.schema.json',
        },
      });
      await persistCredentialSchema({
        schemaName: 'education-db',
        credentialType: 'EducationDb',
        schemaUrl: 'https://example.com/education-db.schema.json',
        displayDescriptorUrls: {
          en: 'https://example.com/education-db.schema.json',
        },
        formSchemaUrls: {
          en: 'https://example.com/education-db.schema.json',
        },
      });
    });

    it('should allow schema url to be retrieved by one schema', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: '/schemas/get-uri?credentialTypes=EducationDegreeGraduationV1.0',
      });

      expect(response.statusCode).toEqual(200);
      responseHeadersExpectation(response);
      expect(response.json).toEqual({
        schemaFileNames: [
          {
            id: 'https://example.com/schema.json',
            credentialType: 'EducationDegreeGraduationV1.0',
          },
        ],
      });
    });

    it('should allow schema url to be retrieved for an in db schema', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: '/schemas/get-uri?credentialTypes=EducationDb',
      });

      expect(response.statusCode).toEqual(200);
      responseHeadersExpectation(response);
      expect(response.json).toEqual({
        schemaFileNames: [
          {
            id: 'https://example.com/education-db.schema.json',
            credentialType: 'EducationDb',
          },
        ],
      });
    });

    it('should allow schema url to be retrieved by 2 schemas', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: '/schemas/get-uri?credentialTypes=EducationDegreeGraduationV1.0&credentialTypes=Course',
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        schemaFileNames: expect.arrayContaining([
          {
            id: 'https://example.com/course.schema.json',
            credentialType: 'Course',
          },
          {
            id: 'https://example.com/schema.json',
            credentialType: 'EducationDegreeGraduationV1.0',
          },
        ]),
      });
    });

    it('should respond with empty array if schema not found', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: '/schemas/get-uri?credentialTypes=Phone&credentialTypes=',
      });

      expect(response.statusCode).toEqual(200);
      responseHeadersExpectation(response);
      expect(response.json).toEqual({
        schemaFileNames: [],
      });
    });
  });

  describe('Schema Retrieval', () => {
    it('should respond 404 if credential unknown and return suggestion', async () => {
      await persistCredentialSchema({
        schemaName: 'course',
        credentialType: 'Course',
        schemaUrl: 'https://example.com/course.schema.json',
        displayDescriptorUrls: {
          en: 'https://example.com/course.schema.json',
        },
        formSchemaUrls: {
          en: 'https://example.com/course.schema.json',
        },
      });

      const response = await fastify.injectJson({
        method: 'GET',
        url: '/api/v0.6/schemas/courses',
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'missing_error_code',
          message: "Schema courses not found. Did you mean 'course'?",
          statusCode: 404,
        })
      );
    });

    it('should allow schemas be retrieved', async () => {
      const json = require('../../../samples/sample-lib-app/schemas/education-degree-graduation-v1.1.schema.json');
      await persistCredentialSchema({
        schemaUrl: 'https://example.com/schema.json',
        displayDescriptorUrls: {
          en: 'https://example.com/display.json',
        },
        formSchemaUrls: {
          en: 'https://example.com/form.json',
        },
      });
      const fetchNock = nock('https://example.com')
        .get('/schema.json')
        .times(1)
        .reply(200, json);
      const response = await fastify.injectJson({
        method: 'GET',
        url: '/schemas/education-degree-graduation-v1.0',
      });
      expect(response.statusCode).toEqual(200);
      responseHeadersExpectation(response);
      expect(response.headers).toMatchObject({
        'content-type': 'application/json; charset=UTF-8',
      });
      expect(response.json).toEqual(json);
      expect(fetchNock.isDone()).toBe(true);
    });

    it('should allow schemas be retrieved when schema name is fully kebab-cased', async () => {
      const json = require('../../../samples/sample-lib-app/schemas/education-degree-graduation-v1.1.schema.json');
      await persistCredentialSchema({
        schemaUrl: 'https://example.com/schema.json',
        displayDescriptorUrls: {
          en: 'https://example.com/display.json',
        },
        formSchemaUrls: {
          en: 'https://example.com/form.json',
        },
      });
      const fetchNock = nock('https://example.com')
        .get('/schema.json')
        .times(1)
        .reply(200, json);
      const response = await fastify.injectJson({
        method: 'GET',
        url: '/schemas/education-degree-graduation-v-1-0',
      });

      expect(response.statusCode).toEqual(200);
      responseHeadersExpectation(response);
      expect(response.headers).toMatchObject({
        'content-type': 'application/json; charset=UTF-8',
      });
      expect(response.json).toEqual(json);
      expect(fetchNock.isDone()).toBe(true);
    });

    it('should allow schemas be retrieved on the old url', async () => {
      const json = require('../../../samples/sample-lib-app/schemas/education-degree-graduation-v1.1.schema.json');
      await persistCredentialSchema({
        schemaUrl: 'https://example.com/schema.json',
        displayDescriptorUrls: {
          en: 'https://example.com/display.json',
        },
        formSchemaUrls: {
          en: 'https://example.com/form.json',
        },
      });
      const fetchNock = nock('https://example.com')
        .get('/schema.json')
        .times(1)
        .reply(200, json);
      const response = await fastify.injectJson({
        method: 'GET',
        url: '/api/v0.6/schemas/education-degree-graduation-v1.0.schema.json',
      });

      expect(response.statusCode).toEqual(200);
      responseHeadersExpectation(response);
      expect(response.headers).toMatchObject({
        'content-type': 'application/json; charset=UTF-8',
      });
      expect(response.json).toEqual(json);
      expect(fetchNock.isDone()).toBe(true);
    });
  });

  describe('Schema validation', () => {
    it('should respond 200 if valid', async () => {
      await persistCredentialSchema(educationDegreeCredentialTypeMetadata);
      const fetchNock = nock('https://example.com')
        .get(`/${educationDegreeCredentialTypeMetadata.schemaName}.schema.json`)
        .times(1)
        .reply(200, educationDegreeSchema);

      const response = await fastify.injectJson({
        method: 'POST',
        url: `/api/v0.6/schemas/${educationDegreeCredentialTypeMetadata.schemaName}/validate`,
        payload: samplePayload(),
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({ valid: true });
      expect(fetchNock.isDone()).toBe(true);
    });
    it('should respond 400 if validation errors (missing required props or formatting errors)', async () => {
      await persistCredentialSchema(educationDegreeCredentialTypeMetadata);
      nock('https://example.com')
        .get(`/${educationDegreeCredentialTypeMetadata.schemaName}.schema.json`)
        .times(1)
        .reply(200, educationDegreeSchema);

      const payload = samplePayload({
        'institution.place.addressRegion': 'USA-CA',
        alignment: [{ something: '' }],
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: `/schemas/${educationDegreeCredentialTypeMetadata.schemaName}/validate`,
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual({
        valid: false,
        errors: [
          '/institution/place/addressRegion must match pattern "^[A-Z]{2}(-[A-Z0-9]{1,3})?$"',
          "/alignment/0 must have required property 'targetName'",
          "/alignment/0 must have required property 'targetUrl'",
          '/alignment/0 must NOT have additional properties',
        ],
      });
    });
    it('should respond 404 if credential type that is unknown and return suggestion', async () => {
      await persistCredentialSchema({
        schemaName: 'course',
        credentialType: 'Course',
      });
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/api/v0.6/schemas/courses/validate',
        payload: samplePayload(),
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'missing_error_code',
          message: "Schema courses not found. Did you mean 'course'?",
          statusCode: 404,
        })
      );
    });
  });

  const responseHeadersExpectation = (response) => {
    expect(response.headers['cache-control']).toEqual(
      'public,max-age=31536000,immutable'
    );
  };
});

const educationDegreeCredentialTypeMetadata = {
  schemaName: 'education-degree-graduation-v1.1',
  credentialType: 'EducationDegreeGraduationV1.1',
  schemaUrl: 'https://example.com/education-degree-graduation-v1.1.schema.json',
  displayDescriptorUrls: {
    en: 'https://example.com/education-degree-graduation-v1.1.descriptor.json',
  },
  formSchemaUrls: {
    en: 'https://example.com/education-degree-graduation-v1.1.form-schema.json',
  },
};
const samplePayload = (overrides) =>
  applyOverrides(
    {
      vendorUserId: 'foo',
      ...sampleEducationDegreeGraduation({
        profile: {
          name: 'ACME University',
          location: { countryCode: 'US', regionCode: 'US-CA' },
        },
        didDoc: { id: 'did:key:1234' },
      }),
    },
    overrides
  );
