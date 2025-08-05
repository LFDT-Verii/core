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
const { ObjectId } = require('mongodb');
const { KeyAlgorithms } = require('@verii/crypto');
const {
  OBJECT_ID_FORMAT,
  ISO_DATETIME_FORMAT,
} = require('@verii/test-regexes');
const {
  testRegistrarUser,
  testRegistrarSuperUser,
  mongoify,
  DEFAULT_GROUP_ID,
  errorResponseMatcher,
} = require('@verii/tests-helpers');
const { map, omit } = require('lodash/fp');
const buildFastify = require('./helpers/build-fastify');
const { CredentialGroup, VNF_GROUP_ID_CLAIM } = require('../src/entities');
const initCredentialSchemaFactory = require('./factories/credential-schema-factory');

const convertToJson = ({ _id, ...x }) => ({
  id: _id,
  issuerCategory: 'RegularIssuer',
  ...omit(['title'], x),
});

const fieldsToOmit = [
  'title',
  '_id',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
  'createdByGroup',
];

const expectedCredentialType = (payload, user = testRegistrarSuperUser) => ({
  _id: expect.any(ObjectId),
  createdAt: expect.any(Date),
  updatedAt: expect.any(Date),
  createdBy: user.sub,
  updatedBy: user.sub,
  createdByGroup: user?.[VNF_GROUP_ID_CLAIM],
  issuerCategory: 'RegularIssuer',
  defaultSignatureAlgorithm: KeyAlgorithms.SECP256K1,
  recommended: false,
  ...payload,
});

describe('credential types endpoints', () => {
  let fastify;
  let persistCredentialSchema;

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();
    ({ persistCredentialSchema } = initCredentialSchemaFactory(fastify));
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

  describe('credential type creation', () => {
    it('should respond 400 to a invalid creation', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/api/v0.6/credential-types',
        payload: { schemaName: 'education-degree' },
      });

      expect(response.statusCode).toEqual(400);
    });

    it('should respond 400 if no schemaName', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/api/v0.6/credential-types',
        payload: {
          credentialType: 'EducationDegree',
          credentialGroup: CredentialGroup.Career,
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message: "body must have required property 'schemaName'",
          statusCode: 400,
        })
      );
    });

    it('should respond 400 if no layer1', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/api/v0.6/credential-types',
        payload: {
          credentialType: 'EducationDegree',
          credentialGroup: CredentialGroup.Career,
          schemaName: 'education-degree',
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message: "body must have required property 'layer1'",
          statusCode: 400,
        })
      );
    });

    it('should respond 400 if no credential group', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/api/v0.6/credential-types',
        payload: {
          credentialType: 'EducationDegree',
          schemaName: 'education-degree',
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message: "body must have required property 'credentialGroup'",
          statusCode: 400,
        })
      );
    });

    it('should respond 400 if no schemaUrl', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/api/v0.6/credential-types',
        payload: {
          credentialType: 'EducationDegree',
          credentialGroup: CredentialGroup.Career,
          schemaName: 'education-degree',
          layer1: true,
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message: "body must have required property 'schemaUrl'",
          statusCode: 400,
        })
      );
    });

    it('should respond 400 if no displayDescriptorUrls', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/api/v0.6/credential-types',
        payload: {
          credentialType: 'EducationDegree',
          credentialGroup: CredentialGroup.Career,
          schemaName: 'education-degree',
          layer1: true,
          schemaUrl: 'https://example.com/schema.json',
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message: "body must have required property 'displayDescriptorUrls'",
          statusCode: 400,
        })
      );
    });

    it('should respond 400 if displayDescriptorUrls has not en version', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/api/v0.6/credential-types',
        payload: {
          credentialType: 'EducationDegree',
          credentialGroup: CredentialGroup.Career,
          schemaName: 'education-degree',
          layer1: true,
          schemaUrl: 'https://example.com/schema.json',
          displayDescriptorUrls: {
            it: 'https://example.com/schema.json',
          },
          formSchemaUrls: {
            en: 'https://example.com/schema.json',
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message:
            "body/displayDescriptorUrls must have required property 'en'",
          statusCode: 400,
        })
      );
    });

    it('should respond 400 if formSchemaUrls empty object', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/api/v0.6/credential-types',
        payload: {
          credentialType: 'EducationDegree',
          credentialGroup: CredentialGroup.Career,
          schemaName: 'education-degree',
          layer1: true,
          schemaUrl: 'https://example.com/schema.json',
          displayDescriptorUrls: {
            en: 'https://example.com/schema.json',
          },
          formSchemaUrls: {},
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message: 'body/formSchemaUrls must NOT have fewer than 1 properties',
          statusCode: 400,
        })
      );
    });

    it('should respond 400 if formSchemaUrls has not en version', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/api/v0.6/credential-types',
        payload: {
          credentialType: 'EducationDegree',
          credentialGroup: CredentialGroup.Career,
          schemaName: 'education-degree',
          layer1: true,
          schemaUrl: 'https://example.com/schema.json',
          displayDescriptorUrls: {
            en: 'https://example.com/schema.json',
          },
          formSchemaUrls: {
            it: 'https://example.com/schema.json',
          },
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message: "body/formSchemaUrls must have required property 'en'",
          statusCode: 400,
        })
      );
    });

    it('should respond 400 when some url for file invalid', async () => {
      const fetchNock = nock('https://example.com')
        .get('/schema.json')
        .times(3)
        .reply(404, {});
      const payload = {
        credentialType: 'EducationDegree',
        credentialGroup: CredentialGroup.Career,
        schemaName: 'education-degree',
        linkedinProfileCompatible: false,
        layer1: true,
        schemaUrl: 'https://example.com/schema.json',
        displayDescriptorUrls: {
          en: 'https://example.com/schema.json',
        },
        formSchemaUrls: {
          en: 'https://example.com/schema.json',
        },
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: '/api/v0.6/credential-types',
        payload,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'invalid-credential-type-link',
          message: 'Invalid credential type link',
          statusCode: 400,
        })
      );

      expect(fetchNock.isDone()).toEqual(true);
    });

    it('should respond 201 to a create a credential type', async () => {
      const fetchNock = nock('https://example.com')
        .get('/schema.json')
        .times(3)
        .reply(200, {
          $id: 'https://example.com/schema.json',
        });
      const payload = {
        credentialType: 'EducationDegree',
        credentialGroup: CredentialGroup.Career,
        schemaName: 'education-degree',
        linkedinProfileCompatible: false,
        layer1: true,
        schemaUrl: 'https://example.com/schema.json',
        displayDescriptorUrls: {
          en: 'https://example.com/schema.json',
        },
        formSchemaUrls: {
          en: 'https://example.com/schema.json',
        },
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: '/api/v0.6/credential-types',
        payload,
      });

      expect(response.statusCode).toEqual(201);
      expect(response.json).toEqual({
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        ...payload,
        defaultSignatureAlgorithm: KeyAlgorithms.SECP256K1,
        issuerCategory: 'RegularIssuer',
        recommended: false,
        updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });

      const credentialSchema = await mongoDb()
        .collection('credentialSchemas')
        .find()
        .toArray();
      expect(credentialSchema).toEqual([
        expectedCredentialType(payload, testRegistrarSuperUser),
      ]);
      expect(fetchNock.isDone()).toEqual(true);
    });

    it('should respond 201 to a create with adding user group', async () => {
      const fetchNock = nock('https://example.com')
        .get('/schema.json')
        .times(3)
        .reply(200, {
          $id: 'https://example.com/schema.json',
        });

      const payload = {
        credentialType: 'EducationDegree',
        credentialGroup: CredentialGroup.Career,
        schemaName: 'education-degree',
        recommended: true,
        linkedinProfileCompatible: false,
        layer1: true,
        schemaUrl: 'https://example.com/schema.json',
        displayDescriptorUrls: {
          en: 'https://example.com/schema.json',
        },
        formSchemaUrls: {
          en: 'https://example.com/schema.json',
        },
        defaultSignatureAlgorithm: KeyAlgorithms.RS256,
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: '/api/v0.6/credential-types',
        payload,
        headers: {
          'x-override-oauth-user': JSON.stringify(testRegistrarUser),
        },
      });

      expect(response.statusCode).toEqual(201);
      expect(response.json).toEqual({
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        ...omit(['schema'], payload),
        issuerCategory: 'RegularIssuer',
        defaultSignatureAlgorithm: KeyAlgorithms.RS256,
        updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });

      const credentialSchema = await mongoDb()
        .collection('credentialSchemas')
        .find()
        .toArray();
      expect(credentialSchema).toEqual([
        expectedCredentialType(payload, testRegistrarUser),
      ]);
      expect(fetchNock.isDone()).toEqual(true);
    });
    it('should respond 201 to a create a credential type with issuer category is ContactIssuer and signatureAlgorithm set to RS256', async () => {
      const fetchNock = nock('https://example.com')
        .get('/schema.json')
        .times(3)
        .reply(200, {
          $id: 'https://example.com/schema.json',
        });
      const payload = {
        credentialType: 'Email',
        credentialGroup: CredentialGroup.Career,
        schemaName: 'email',
        linkedinProfileCompatible: false,
        layer1: true,
        schemaUrl: 'https://example.com/schema.json',
        displayDescriptorUrls: {
          en: 'https://example.com/schema.json',
        },
        formSchemaUrls: {
          en: 'https://example.com/schema.json',
        },
        issuerCategory: 'ContactIssuer',
        defaultSignatureAlgorithm: KeyAlgorithms.RS256,
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: '/api/v0.6/credential-types',
        payload,
        headers: {
          'x-override-oauth-user': JSON.stringify(testRegistrarUser),
        },
      });

      expect(response.statusCode).toEqual(201);
      expect(response.json).toEqual({
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        ...payload,
        issuerCategory: 'ContactIssuer',
        recommended: false,
        updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });

      const credentialSchema = await mongoDb()
        .collection('credentialSchemas')
        .find()
        .toArray();
      expect(credentialSchema).toEqual([
        expectedCredentialType(payload, testRegistrarUser),
      ]);
      expect(fetchNock.isDone()).toEqual(true);
    });
    it('should respond 201 to a create a credential type with issuer category is IdDocumentIssuer', async () => {
      const fetchNock = nock('https://example.com')
        .get('/schema.json')
        .times(3)
        .reply(200, {
          $id: 'https://example.com/schema.json',
        });
      const payload = {
        credentialType: 'Email',
        credentialGroup: CredentialGroup.Career,
        schemaName: 'email',
        linkedinProfileCompatible: false,
        issuerCategory: 'IdDocumentIssuer',
        layer1: true,
        schemaUrl: 'https://example.com/schema.json',
        displayDescriptorUrls: {
          en: 'https://example.com/schema.json',
        },
        formSchemaUrls: {
          en: 'https://example.com/schema.json',
        },
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: '/api/v0.6/credential-types',
        payload,
        headers: {
          'x-override-oauth-user': JSON.stringify(testRegistrarUser),
        },
      });

      expect(response.statusCode).toEqual(201);
      expect(response.json).toEqual({
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        ...payload,
        issuerCategory: 'IdDocumentIssuer',
        defaultSignatureAlgorithm: KeyAlgorithms.SECP256K1,
        recommended: false,
        updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });

      const credentialSchema = await mongoDb()
        .collection('credentialSchemas')
        .find()
        .toArray();
      expect(credentialSchema).toEqual([
        expectedCredentialType(payload, testRegistrarUser),
      ]);
      expect(fetchNock.isDone()).toEqual(true);
    });
  });
  describe('credential type update', () => {
    it('should respond 200 and update credential type', async () => {
      const fetchNock = nock('https://example.com')
        .get('/schema.json')
        .times(3)
        .reply(200, {
          $id: 'https://example.com/schema.json',
        });
      const credentialType = await persistCredentialSchema({
        credentialType: 'Badge',
        schemaName: 'obi',
        createdBy: 'auth0|111',
        updatedBy: 'auth0|111',
        createdByGroup: DEFAULT_GROUP_ID,
        linkedinProfileCompatible: false,
      });

      const response = await fastify.injectJson({
        method: 'PUT',
        url: `/api/v0.6/credential-types/${credentialType._id}`,
        payload: {
          ...omit(fieldsToOmit, credentialType),
          credentialType: 'EducationDegree',
          schemaName: 'fat',
          recommended: true,
          linkedinProfileCompatible: false,
        },
        headers: {
          'x-override-oauth-user': JSON.stringify(testRegistrarUser),
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        ...omit(fieldsToOmit, credentialType),
        credentialType: 'EducationDegree',
        issuerCategory: 'RegularIssuer',
        defaultSignatureAlgorithm: KeyAlgorithms.SECP256K1,
        schemaName: 'fat',
        updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });

      const credentialSchema = await mongoDb()
        .collection('credentialSchemas')
        .find()
        .toArray();
      expect(credentialSchema).toEqual([
        expectedCredentialType(
          {
            ...omit(fieldsToOmit, credentialType),
            credentialType: 'EducationDegree',
            schemaName: 'fat',
            linkedinProfileCompatible: false,
            recommended: true,
            createdBy: 'auth0|111',
            title: 'Badge',
            createdByGroup: DEFAULT_GROUP_ID,
            jsonldContext: [
              'https://lib.velocitynetwork.foundation/layer1-v1.1.jsonld.json',
            ],
          },
          testRegistrarUser
        ),
      ]);
      expect(fetchNock.isDone()).toEqual(true);
    });
    it('should respond 200 and update credential type if user is superuser', async () => {
      const fetchNock = nock('https://example.com')
        .get('/schema.json')
        .times(3)
        .reply(200, {
          $id: 'https://example.com/schema.json',
        });
      const credentialType = await persistCredentialSchema({
        credentialType: 'Badge',
        schemaName: 'obi',
        createdBy: 'auth0|111',
        updatedBy: 'auth0|111',
        createdByGroup: DEFAULT_GROUP_ID,
        linkedinProfileCompatible: false,
      });

      const response = await fastify.injectJson({
        method: 'PUT',
        url: `/api/v0.6/credential-types/${credentialType._id}`,
        payload: {
          ...omit(fieldsToOmit, credentialType),
          credentialType: 'EducationDegree',
          schemaName: 'fat',
          recommended: true,
          linkedinProfileCompatible: false,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        id: expect.stringMatching(OBJECT_ID_FORMAT),
        ...omit(fieldsToOmit, credentialType),
        credentialType: 'EducationDegree',
        issuerCategory: 'RegularIssuer',
        defaultSignatureAlgorithm: KeyAlgorithms.SECP256K1,
        schemaName: 'fat',
        updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      });

      const credentialSchema = await mongoDb()
        .collection('credentialSchemas')
        .find()
        .toArray();
      expect(credentialSchema).toEqual([
        expectedCredentialType({
          ...omit(fieldsToOmit, credentialType),
          credentialType: 'EducationDegree',
          schemaName: 'fat',
          linkedinProfileCompatible: false,
          recommended: true,
          createdBy: 'auth0|111',
          title: 'Badge',
          createdByGroup: DEFAULT_GROUP_ID,
          jsonldContext: [
            'https://lib.velocitynetwork.foundation/layer1-v1.1.jsonld.json',
          ],
        }),
      ]);
      expect(fetchNock.isDone()).toEqual(true);
    });
    it('should respond 400 when link to file invalid', async () => {
      const fetchNock = nock('https://example.com')
        .get('/schema.json')
        .times(3)
        .reply(404, {});
      const credentialType = await persistCredentialSchema({
        credentialType: 'Badge',
        createdBy: 'auth0|111',
        updatedBy: 'auth0|111',
        createdByGroup: DEFAULT_GROUP_ID,
      });

      const response = await fastify.injectJson({
        method: 'PUT',
        url: `/api/v0.6/credential-types/${credentialType._id}`,
        payload: {
          ...omit(fieldsToOmit, credentialType),
          credentialType: 'EducationDegree',
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'invalid-credential-type-link',
          message: 'Invalid credential type link',
          statusCode: 400,
        })
      );

      expect(await mongoDb().collection('credentialSchemas').findOne()).toEqual(
        mongoify(credentialType)
      );
      expect(fetchNock.isDone()).toEqual(true);
    });
    it('should respond 403 to a update when group not match', async () => {
      const credentialType = await persistCredentialSchema({
        createdBy: 'auth0|123654',
        updatedBy: 'auth0|123654',
        createdByGroup: 'group',
      });

      const response = await fastify.injectJson({
        method: 'PUT',
        url: `/api/v0.6/credential-types/${credentialType._id}`,
        payload: {
          ...omit(fieldsToOmit, credentialType),
          credentialType: 'EducationDegree',
          schemaName: 'fat',
          recommended: true,
        },
        headers: {
          'x-override-oauth-user': JSON.stringify({
            sub: 'auth0|123654',
            scope: 'write:credentialTypes',
            [VNF_GROUP_ID_CLAIM]: DEFAULT_GROUP_ID,
          }),
        },
      });

      expect(response.statusCode).toEqual(403);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Forbidden',
          errorCode: 'forbidden',
          message: 'You have no rights to modify credential type',
          statusCode: 403,
        })
      );

      const credentialSchema = await mongoDb()
        .collection('credentialSchemas')
        .find()
        .toArray();
      expect(credentialSchema).toEqual([
        {
          ...credentialType,
          issuerCategory: 'RegularIssuer',
          _id: expect.any(ObjectId),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      ]);
    });
    it('should respond 404 to a update when credential type not found', async () => {
      const response = await fastify.injectJson({
        method: 'PUT',
        url: '/api/v0.6/credential-types/123',
        payload: {
          credentialType: 'EducationDegree',
          credentialGroup: CredentialGroup.Career,
          schemaName: 'fat',
          recommended: true,
          layer1: true,
          schemaUrl: 'https://example.com/schema.json',
          displayDescriptorUrls: {
            en: 'https://example.com/schema.json',
          },
          formSchemaUrls: {
            en: 'https://example.com/schema.json',
          },
        },
        headers: {
          'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
        },
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'missing_error_code',
          message: 'credentialSchemas 123 not found',
          statusCode: 404,
        })
      );
    });
  });
  describe('credential type deletion', () => {
    it('should respond 204 to a delete', async () => {
      const credentialTypes = await Promise.all([
        persistCredentialSchema(),
        persistCredentialSchema({
          credentialType: 'Badge',
          schemaName: 'obi',
          createdByGroup: DEFAULT_GROUP_ID,
        }),
      ]);

      const response = await fastify.injectJson({
        method: 'DELETE',
        url: `/api/v0.6/credential-types/${credentialTypes[1]._id}`,
        headers: {
          'x-override-oauth-user': JSON.stringify(testRegistrarUser),
        },
      });
      expect(response.statusCode).toEqual(204);
    });
    it('should respond 204 to a delete if user is superuser', async () => {
      const credentialTypes = await Promise.all([
        persistCredentialSchema(),
        persistCredentialSchema({
          credentialType: 'Badge',
          schemaName: 'obi',
          createdByGroup: DEFAULT_GROUP_ID,
        }),
      ]);

      const response = await fastify.injectJson({
        method: 'DELETE',
        url: `/api/v0.6/credential-types/${credentialTypes[1]._id}`,
      });
      expect(response.statusCode).toEqual(204);
    });
    it('should respond 403 to a delete when group not match', async () => {
      const credentialType = await persistCredentialSchema({
        createdBy: 'auth0|123654',
        updatedBy: 'auth0|123654',
        createdByGroup: 'group',
      });

      const response = await fastify.injectJson({
        method: 'DELETE',
        url: `/api/v0.6/credential-types/${credentialType._id}`,
        headers: {
          'x-override-oauth-user': JSON.stringify({
            sub: 'auth0|123654',
            scope: 'write:credentialTypes',
            [VNF_GROUP_ID_CLAIM]: DEFAULT_GROUP_ID,
          }),
        },
      });

      expect(response.statusCode).toEqual(403);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Forbidden',
          errorCode: 'forbidden',
          message: 'You have no rights to modify credential type',
          statusCode: 403,
        })
      );

      expect(await mongoDb().collection('credentialSchemas').findOne()).toEqual(
        mongoify(credentialType)
      );
    });
    it('should respond 404 to a delete when credential type not found', async () => {
      const response = await fastify.injectJson({
        method: 'DELETE',
        url: '/api/v0.6/credential-types/123',
        headers: {
          'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
        },
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'missing_error_code',
          message: 'credentialSchemas 123 not found',
          statusCode: 404,
        })
      );
    });
  });
  describe('credential type retrieval', () => {
    it('should respond 200 to a get all', async () => {
      const credentialTypes = await Promise.all([
        persistCredentialSchema({
          linkedIn: { shareInProfile: true, shareInFeed: true },
          linkedinProfileCompatible: false,
        }),
        persistCredentialSchema({
          credentialType: 'Badge',
          schemaName: 'obi',
          linkedIn: { shareInProfile: true, shareInFeed: true },
          linkedinProfileCompatible: false,
        }),
      ]);

      const response = await fastify.injectJson({
        method: 'GET',
        url: '/api/v0.6/credential-types',
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual(
        expect.arrayContaining(map(convertToJson, credentialTypes))
      );
      expect(response.json[0].linkedIn).toEqual(credentialTypes[0].linkedIn);
    });
    it('should respond 200 to a get list credential types', async () => {
      const credentialType1 = await persistCredentialSchema({
        credentialType: 'Badge1',
        schemaName: 'obi1',
        linkedinProfileCompatible: false,
      });
      const credentialType2 = await persistCredentialSchema({
        credentialType: 'Badge',
        schemaName: 'obi',
        linkedinProfileCompatible: false,
      });
      const response = await fastify.injectJson({
        method: 'GET',
        url: '/api/v0.6/credential-types?credentialType=Badge&credentialType=Badge1',
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json.length).toEqual(2);
      expect(response.json).toEqual(
        expect.arrayContaining([
          convertToJson(credentialType2),
          convertToJson(credentialType1),
        ])
      );
    });
    it('should respond 404 to a missing  get one', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: `/api/v0.6/credential-types/${new ObjectId()}`,
      });
      expect(response.statusCode).toEqual(404);
    });
    it('should respond 200 to a get one', async () => {
      const credentialTypes = await Promise.all([
        persistCredentialSchema(),
        persistCredentialSchema({
          credentialType: 'Badge',
          schemaName: 'obi',
          linkedinProfileCompatible: false,
        }),
      ]);
      const response = await fastify.injectJson({
        method: 'GET',
        url: `/api/v0.6/credential-types/${credentialTypes[1]._id}`,
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual(convertToJson(credentialTypes[1]));
      expect(response.json.jsonldContext).toEqual([
        'https://lib.velocitynetwork.foundation/layer1-v1.1.jsonld.json',
      ]);
    });
    it('should respond 200 to a get one by credential type', async () => {
      const credentialTypes = await Promise.all([
        persistCredentialSchema(),
        persistCredentialSchema({
          credentialType: 'Badge',
          schemaName: 'obi',
          linkedinProfileCompatible: false,
        }),
      ]);
      const response = await fastify.injectJson({
        method: 'GET',
        url: '/api/v0.6/credential-types?credentialType=Badge',
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual([convertToJson(credentialTypes[1])]);
    });
  });
});
