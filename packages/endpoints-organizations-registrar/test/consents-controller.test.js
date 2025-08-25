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

const {
  testReadOrganizationsUser,
  testRegistrarSuperUser,
  testWriteOrganizationsUser,
  mongoify,
  errorResponseMatcher,
} = require('@verii/tests-helpers');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { ObjectId } = require('mongodb');
const { omit } = require('lodash/fp');
const initConsentsFactory = require('../src/entities/registrar-consents/factories/registrar-consents-factory');
const initOrganizationFactory = require('../src/entities/organizations/factories/organizations-factory');
const buildFastify = require('./helpers/build-fastify');
const consentsRepoPlugin = require('../src/entities/registrar-consents/repos/repo');
const { ConsentTypes } = require('../src/entities');

describe('Registrar Consents controller', () => {
  let fastify;
  let persistRegistrarConsent;
  let persistOrganization;

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();
    ({ persistRegistrarConsent } = initConsentsFactory(fastify));
    ({ persistOrganization } = initOrganizationFactory(fastify));
  }, 5000);
  after(async () => {
    await fastify.close();
  });
  beforeEach(async () => {
    await mongoDb().collection('registrarConsents').deleteMany({});
  });

  it('If version is missing in the body, 400 error version required message', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: '/api/v0.6/consents',
      payload: {},
      headers: {
        'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
      },
    });
    expect(response.json).toEqual(
      errorResponseMatcher({
        error: 'Bad Request',
        errorCode: 'request_validation_failed',
        message: "body must have required property 'version'",
        statusCode: 400,
      })
    );
  });

  it('should get an error for unauthorized user', async () => {
    const response = await fastify.injectJson({
      method: 'GET',
      url: '/api/v0.6/consents',
      headers: { 'x-override-oauth-unauthorized': {} },
    });
    expect(response.statusCode).toEqual(401);
    expect(response.json).toEqual(
      errorResponseMatcher({
        error: 'Unauthorized',
        message: 'Unauthorized',
        errorCode: 'missing_error_code',
        statusCode: 401,
      })
    );
  });

  it('should create consent for user', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: '/api/v0.6/consents',
      payload: {
        version: '1.0.1',
        type: 'CAO',
      },
      headers: {
        'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
      },
    });
    const consentsRepo = await consentsRepoPlugin(fastify)({
      log: fastify.log,
      config: fastify.config,
    });
    const consent = await consentsRepo.findOne({
      filter: { userId: testRegistrarSuperUser.sub },
    });
    expect(response.statusCode).toEqual(200);
    expect(consent).toEqual({
      _id: expect.any(ObjectId),
      userId: testRegistrarSuperUser.sub,
      consentId: expect.any(String),
      version: '1.0.1',
      createdAt: expect.any(Date),
      type: 'CAO',
    });
    expect(response.json).toEqual({
      consent: {
        createdAt: expect.anything(),
        id: expect.any(String),
        userId: testRegistrarSuperUser.sub,
        version: '1.0.1',
        type: 'CAO',
      },
    });
  });

  it("should create consent for user's organization", async () => {
    const organization = await persistOrganization();
    const response = await fastify.injectJson({
      method: 'POST',
      url: '/api/v0.6/consents',
      payload: {
        version: '1.0.1',
        type: ConsentTypes.IssuerInspector,
        did: organization.didDoc.id,
      },
      headers: {
        'x-override-oauth-user': JSON.stringify(testWriteOrganizationsUser),
      },
    });
    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual({
      consent: {
        createdAt: expect.anything(),
        id: expect.any(String),
        userId: testWriteOrganizationsUser.sub,
        organizationId: organization._id,
        version: '1.0.1',
        type: ConsentTypes.IssuerInspector,
      },
    });

    const consentsRepo = await consentsRepoPlugin(fastify)({
      log: fastify.log,
      config: fastify.config,
    });
    const dbConsent = await consentsRepo.findOne({
      filter: { userId: testWriteOrganizationsUser.sub },
    });
    expect(dbConsent).toEqual(
      mongoify({
        ...omit(['id'], response.json.consent),
        _id: expect.any(ObjectId),
        consentId: response.json.consent.id,
      })
    );
  });

  it('should get the consents for this user', async () => {
    const testconsent1 = await persistRegistrarConsent({
      userId: testReadOrganizationsUser.sub,
      type: 'NodeOperator',
    });
    const testconsent2 = await persistRegistrarConsent({
      userId: testReadOrganizationsUser.sub,
      type: 'CAO',
    });
    const response = await fastify.injectJson({
      method: 'GET',
      url: '/api/v0.6/consents',
      headers: {
        'x-override-oauth-user': JSON.stringify(testReadOrganizationsUser),
      },
    });
    expect(response.statusCode).toEqual(200);
    const time2 = new Date(testconsent2.createdAt);
    const time1 = new Date(testconsent1.createdAt);
    expect(time2.getTime()).toBeGreaterThanOrEqual(time1.getTime());
    expect(response.json).toEqual(
      expect.arrayContaining([
        {
          id: testconsent2._id,
          type: 'CAO',
          version: '1',
          userId: testReadOrganizationsUser.sub,
          createdAt: expect.anything(),
        },
        {
          id: testconsent1._id,
          type: 'NodeOperator',
          version: '1',
          userId: testReadOrganizationsUser.sub,
          createdAt: expect.anything(),
        },
      ])
    );
  });

  it('should return empty array if theres no consents for this user', async () => {
    const response = await fastify.injectJson({
      method: 'GET',
      url: '/api/v0.6/consents',
      headers: {
        'x-override-oauth-user': JSON.stringify(testReadOrganizationsUser),
      },
    });
    expect(response.statusCode).toEqual(200);
    expect(response.json).toEqual([]);
  });

  it('If type is missing the default should be AppTerms', async () => {
    const response = await fastify.injectJson({
      method: 'POST',
      url: '/api/v0.6/consents',
      payload: { version: '1.0.1' },
      headers: {
        'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
      },
    });
    const consentsRepo = await consentsRepoPlugin(fastify)({
      config: fastify.config,
    });
    const consent = await consentsRepo.findOne({
      filter: { userId: testRegistrarSuperUser.sub },
    });
    expect(response.json.consent.type).toEqual('RegistrarAppTerms');
    expect(consent.type).toEqual('RegistrarAppTerms');
  });
});
