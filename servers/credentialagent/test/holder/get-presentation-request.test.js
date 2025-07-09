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
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { ObjectId } = require('mongodb');
const {
  sampleOrganizationVerifiedProfile1,
  sampleOrganizationProfile1,
  samplePresentationDefinition,
} = require('@verii/sample-data');
const { jwtVerify } = require('@verii/jwt');
const { omit } = require('lodash/fp');
const { JWT_FORMAT } = require('@verii/test-regexes');
const { generateKeyPair, KeyPurposes } = require('@verii/crypto');
const { matchersWithOptions } = require('jest-json-schema');
const {
  ExchangeTypes,
  ExchangeStates,
  ExchangeProtocols,
  VendorEndpoint,
  initDisclosureFactory,
  initTenantFactory,
  initKeysFactory,
} = require('../../src/entities');
const {
  nockRegistrarGetOrganizationVerifiedProfile,
} = require('../combined/helpers/nock-registrar-get-organization-verified-profile');
const {
  presentationRequestSchema,
  presentationDefinitionV1Schema,
} = require('../../src/controllers/holder/inspect/schemas');
const buildFastify = require('./helpers/credentialagent-holder-build-fastify');
const { holderConfig } = require('../../src/config');

const agentUrl = 'http://localhost.test';
const tenantUrl = ({ tenantId }, suffix) =>
  `/api/holder/v0.6/org/${tenantId}${suffix}`;
const inspectUrl = (tenantId, suffix) =>
  `${tenantUrl({ tenantId }, `/inspect${suffix}`)}`;

expect.extend(
  matchersWithOptions({
    // Loading in a schema which is comprised only of definitions,
    // which means specific test schemas need to be created.
    // This is good for testing specific conditions for definition schemas.
    schemas: [presentationDefinitionV1Schema],
  })
);

describe('presentation request', () => {
  let fastify;
  let persistDisclosure;
  let persistTenant;
  let tenant;
  let nonDidTenant;
  let persistKey;
  let disclosure;
  let nonDisclosure;
  let orgDidDoc;

  beforeAll(async () => {
    fastify = buildFastify();
    await fastify.ready();
    ({ persistDisclosure } = initDisclosureFactory(fastify));
    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistKey } = initKeysFactory(fastify));
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    nock.cleanAll();

    await mongoDb().collection('disclosures').deleteMany({});
    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});
    await mongoDb().collection('exchanges').deleteMany({});
    await mongoDb().collection('vendorUserIdMappings').deleteMany({});

    const keyPair = generateKeyPair({
      format: 'jwk',
    });
    tenant = await persistTenant();
    orgDidDoc = {
      id: tenant.did,
      publicKey: [
        { id: `${tenant.did}#key-1`, publicKeyJwk: keyPair.publicKey },
      ],
      service: [
        {
          id: `${tenant.did}#service-1`,
          type: 'BasicProfileInformation',
          ...sampleOrganizationProfile1,
        },
      ],
    };
    await persistKey({
      tenant,
      kidFragment: `#${orgDidDoc.publicKey[0].id.split('#')[1]}`,
      keyPair,
    });
    await persistKey({
      tenant,
      kidFragment: '#ID1',
      keyPair,
      purposes: [KeyPurposes.DLT_TRANSACTIONS],
    });

    await persistKey({
      tenant,
      kidFragment: '#exchanges-1',
      keyPair,
      purposes: [KeyPurposes.EXCHANGES],
    });
    disclosure = await persistDisclosure({
      tenant,
      vendorEndpoint: VendorEndpoint.RECEIVE_CHECKED_CREDENTIALS,
    });
    nonDidTenant = await persistTenant();
    nonDisclosure = await persistDisclosure({
      tenant: nonDidTenant,
      vendorEndpoint: VendorEndpoint.RECEIVE_CHECKED_CREDENTIALS,
    });

    nock('http://oracle.localhost.test')
      .get('/api/v0.6/credential-types', () => {
        return true;
      })
      .reply(
        200,
        [
          {
            credentialType: 'Passport',
            issuerCategory: 'ContactIssuer',
          },
        ],
        { 'cache-control': 'max-age=3600' }
      );
  });

  afterAll(async () => {
    await fastify.close();
    nock.cleanAll();
    nock.restore();
  });

  const typesToInputDescriptors = {
    PastEmploymentPosition: {
      id: 'PastEmploymentPosition',
      group: ['A'],
      name: 'Past Role',
      schema: [
        {
          uri: 'http://oracle.localhost.test/schemas/PastEmploymentPosition.json',
        },
      ],
    },
    CurrentEmploymentPosition: {
      id: 'CurrentEmploymentPosition',
      group: ['A'],
      name: 'Current Role',
      schema: [
        {
          uri: 'http://oracle.localhost.test/schemas/CurrentEmploymentPosition.json',
        },
      ],
    },
  };

  describe('velocity api presentation request', () => {
    it('should 404 if disclosure id cannot be found', async () => {
      const q = { disclosureId: 'NOT_FOUND' };
      const response = await fastify.injectJson({
        method: 'GET',
        url: inspectUrl(
          tenant.did,
          `/get-presentation-request?id=${q.disclosureId}`
        ),
      });
      expect(response.statusCode).toEqual(404);
    });
    it('should 404 if tenant id can be found', async () => {
      const q = { disclosureId: disclosure._id };
      const response = await fastify.injectJson({
        method: 'GET',
        url: inspectUrl(
          'did:test:not-found',
          `/get-presentation-request?id=${q.disclosureId}`
        ),
      });
      expect(response.statusCode).toEqual(404);
    });
    it('should 500 if tenant did doc cannot be found', async () => {
      const q = { disclosureId: disclosure._id };
      const response = await fastify.injectJson({
        method: 'GET',
        url: inspectUrl(
          tenant.did,
          `/get-presentation-request?id=${q.disclosureId}`
        ),
      });
      expect(response.statusCode).toEqual(500);
    });
    it('should 500 if tenant doesnt have a private key defined', async () => {
      nockRegistrarGetOrganizationVerifiedProfile(
        nonDidTenant.did,
        sampleOrganizationVerifiedProfile1
      );
      nockRegistrarGetCredentialTypes();
      const q = { disclosureId: nonDisclosure._id };
      const response = await fastify.injectJson({
        method: 'GET',
        url: inspectUrl(
          nonDidTenant.did,
          `/get-presentation-request?id=${q.disclosureId}`
        ),
      });
      expect(response.statusCode).toEqual(500);

      const dbExchange = await mongoDb().collection('exchanges').findOne({});
      expect(dbExchange).toEqual({
        _id: expect.any(ObjectId),
        type: ExchangeTypes.DISCLOSURE,
        disclosureId: new ObjectId(nonDisclosure._id),
        events: [
          { state: ExchangeStates.NEW, timestamp: expect.any(Date) },
          {
            state: ExchangeStates.UNEXPECTED_ERROR,
            timestamp: expect.any(Date),
          },
        ],
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
        err: `No key matching the filter {"tenantId":"${nonDidTenant._id}","purposes":"EXCHANGES"} was found`,
        tenantId: new ObjectId(nonDidTenant._id),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
    it('should 200 if many types are defined', async () => {
      nockRegistrarGetOrganizationVerifiedProfile(
        tenant.did,
        sampleOrganizationVerifiedProfile1
      );
      nockRegistrarGetCredentialTypes();
      const q = { disclosureId: disclosure._id };
      const response = await fastify.injectJson({
        method: 'GET',
        url: inspectUrl(
          tenant.did,
          `/get-presentation-request?id=${q.disclosureId}`
        ),
      });
      expect(response.statusCode).toEqual(200);
      const { payload: responsePayload } = await jwtVerify(
        response.json.presentation_request,
        orgDidDoc.publicKey[0].publicKeyJwk
      );
      expect(responsePayload).toMatchSchema(presentationRequestSchema);
      expect(responsePayload).toEqual({
        exchange_id: expect.any(String),
        metadata: {
          client_name: sampleOrganizationProfile1.name,
          logo_uri: sampleOrganizationProfile1.logo,
          tos_uri: disclosure.termsUrl,
          auth_token_uri: `${agentUrl}${tenantUrl(
            { tenantId: tenant.did },
            '/oauth/token'
          )}`,
          max_retention_period: disclosure.duration,
          progress_uri: `${agentUrl}${tenantUrl(
            { tenantId: tenant.did },
            '/get-exchange-progress'
          )}`,
          submit_presentation_uri: `${agentUrl}${inspectUrl(
            tenant.did,
            '/submit-presentation'
          )}`,
        },
        presentation_definition: {
          id: `${responsePayload.exchange_id}.${disclosure._id}`,
          name: disclosure.description,
          purpose: disclosure.purpose,
          format: {
            jwt_vp: { alg: ['secp256k1'] },
          },
          input_descriptors: disclosure.types.map(
            ({ type }) => typesToInputDescriptors[type]
          ),
          submission_requirements: [
            {
              from: 'A',
              min: 1,
              rule: 'pick',
            },
          ],
        },
        exp: expect.any(Number),
        iat: expect.any(Number),
        nbf: expect.any(Number),
        iss: tenant.did,
      });

      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(responsePayload.exchange_id) });
      expect(dbExchange).toEqual({
        _id: new ObjectId(responsePayload.exchange_id),
        type: ExchangeTypes.DISCLOSURE,
        tenantId: new ObjectId(tenant._id),
        disclosureId: new ObjectId(disclosure._id),
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
        events: [{ state: ExchangeStates.NEW, timestamp: expect.any(Date) }],
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
    it('should 200, use presentationDefinition from disclosure and populate purpose from disclosure', async () => {
      disclosure = await persistDisclosure({
        tenant,
        purpose: 'fooPurpose from disclosure',
        presentationDefinition: {
          ...omit(['purpose'], samplePresentationDefinition),
        },
      });
      nockRegistrarGetOrganizationVerifiedProfile(
        tenant.did,
        sampleOrganizationVerifiedProfile1
      );
      nockRegistrarGetCredentialTypes();
      const q = { disclosureId: disclosure._id };
      const response = await fastify.injectJson({
        method: 'GET',
        url: inspectUrl(
          tenant.did,
          `/get-presentation-request?id=${q.disclosureId}`
        ),
      });
      expect(response.statusCode).toEqual(200);
      const { payload: responsePayload } = await jwtVerify(
        response.json.presentation_request,
        orgDidDoc.publicKey[0].publicKeyJwk
      );
      expect(responsePayload).toMatchSchema(presentationRequestSchema);
      expect(responsePayload).toEqual({
        exchange_id: expect.any(String),
        metadata: {
          client_name: sampleOrganizationProfile1.name,
          logo_uri: sampleOrganizationProfile1.logo,
          tos_uri: disclosure.termsUrl,
          auth_token_uri: `${agentUrl}${tenantUrl(
            { tenantId: tenant.did },
            '/oauth/token'
          )}`,
          max_retention_period: disclosure.duration,
          progress_uri: `${agentUrl}${tenantUrl(
            { tenantId: tenant.did },
            '/get-exchange-progress'
          )}`,
          submit_presentation_uri: `${agentUrl}${inspectUrl(
            tenant.did,
            '/submit-presentation'
          )}`,
        },
        presentation_definition: {
          id: `${responsePayload.exchange_id}.${disclosure._id}`,
          purpose: 'fooPurpose from disclosure',
          name: 'fooName',
          format: {
            jwt_vp: { alg: ['secp256k1'] },
          },
          input_descriptors: [
            {
              id: 'CurrentEmployment',
              name: 'Current Employment',
              schema: [
                {
                  uri: 'https://example.com/employment-current-v1.1.schema.json',
                },
              ],
              group: ['A'],
            },
            {
              id: 'PastEmployment',
              name: 'Past Employment',
              schema: [
                {
                  uri: 'https://example.com/employment-past-v1.1.schema.json',
                },
              ],
              group: ['A'],
            },
            {
              id: 'OpenBadge',
              name: 'Badges',
              schema: [
                {
                  uri: 'https://example.com/open-badge-credential.schema.json',
                },
              ],
              group: ['B'],
            },
          ],
          submission_requirements: [
            {
              rule: 'all',
              from: 'A',
              min: 1,
            },
          ],
        },
        exp: expect.any(Number),
        iat: expect.any(Number),
        nbf: expect.any(Number),
        iss: tenant.did,
      });

      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(responsePayload.exchange_id) });
      expect(dbExchange).toEqual({
        _id: new ObjectId(responsePayload.exchange_id),
        type: ExchangeTypes.DISCLOSURE,
        tenantId: new ObjectId(tenant._id),
        disclosureId: new ObjectId(disclosure._id),
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
        events: [{ state: ExchangeStates.NEW, timestamp: expect.any(Date) }],
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
    it('should 200 when route has tenantId', async () => {
      disclosure = await persistDisclosure({
        tenant,
        purpose: 'fooPurpose from disclosure',
        presentationDefinition: {
          ...omit(['purpose'], samplePresentationDefinition),
        },
      });
      nockRegistrarGetOrganizationVerifiedProfile(
        tenant.did,
        sampleOrganizationVerifiedProfile1
      );
      nockRegistrarGetCredentialTypes();
      const q = { disclosureId: disclosure._id };
      const response = await fastify.injectJson({
        method: 'GET',
        url: inspectUrl(
          tenant._id,
          `/get-presentation-request?id=${q.disclosureId}`
        ),
      });
      expect(response.statusCode).toEqual(200);
    });
    it("should 200 when route has tenant's did alias", async () => {
      const didAlias = 'did:aka:foo';
      const customTenant = await persistTenant({ dids: [didAlias] });
      const keyPair = generateKeyPair({
        format: 'jwk',
      });
      await persistKey({
        tenant: customTenant,
        kidFragment: '#exchanges-1',
        keyPair,
        purposes: [KeyPurposes.EXCHANGES],
      });
      disclosure = await persistDisclosure({
        tenant: customTenant,
        purpose: 'fooPurpose from disclosure',
        presentationDefinition: {
          ...omit(['purpose'], samplePresentationDefinition),
        },
      });
      nockRegistrarGetOrganizationVerifiedProfile(
        customTenant.did,
        sampleOrganizationVerifiedProfile1
      );
      nockRegistrarGetCredentialTypes();
      const q = { disclosureId: disclosure._id };
      const response = await fastify.injectJson({
        method: 'GET',
        url: inspectUrl(
          didAlias,
          `/get-presentation-request?id=${q.disclosureId}`
        ),
      });
      expect(response.statusCode).toEqual(200);
    });
    it('should 200, use presentationDefinition from disclosure and override disclosure purpose ', async () => {
      disclosure = await persistDisclosure({
        tenant,
        presentationDefinition: {
          ...samplePresentationDefinition,
          purpose: 'fooPurpose',
        },
      });
      nockRegistrarGetOrganizationVerifiedProfile(
        tenant.did,
        sampleOrganizationVerifiedProfile1
      );
      nockRegistrarGetCredentialTypes();
      const q = { disclosureId: disclosure._id };
      const response = await fastify.injectJson({
        method: 'GET',
        url: inspectUrl(
          tenant.did,
          `/get-presentation-request?id=${q.disclosureId}`
        ),
      });
      expect(response.statusCode).toEqual(200);
      const { payload: responsePayload } = await jwtVerify(
        response.json.presentation_request,
        orgDidDoc.publicKey[0].publicKeyJwk
      );
      expect(responsePayload).toMatchSchema(presentationRequestSchema);
      expect(responsePayload).toEqual({
        exchange_id: expect.any(String),
        metadata: {
          client_name: sampleOrganizationProfile1.name,
          logo_uri: sampleOrganizationProfile1.logo,
          tos_uri: disclosure.termsUrl,
          auth_token_uri: `${agentUrl}${tenantUrl(
            { tenantId: tenant.did },
            '/oauth/token'
          )}`,
          max_retention_period: disclosure.duration,
          progress_uri: `${agentUrl}${tenantUrl(
            { tenantId: tenant.did },
            '/get-exchange-progress'
          )}`,
          submit_presentation_uri: `${agentUrl}${inspectUrl(
            tenant.did,
            '/submit-presentation'
          )}`,
        },
        presentation_definition: {
          id: `${responsePayload.exchange_id}.${disclosure._id}`,
          purpose: 'fooPurpose',
          name: 'fooName',
          format: {
            jwt_vp: { alg: ['secp256k1'] },
          },
          input_descriptors: [
            {
              id: 'CurrentEmployment',
              name: 'Current Employment',
              schema: [
                {
                  uri: 'https://example.com/employment-current-v1.1.schema.json',
                },
              ],
              group: ['A'],
            },
            {
              id: 'PastEmployment',
              name: 'Past Employment',
              schema: [
                {
                  uri: 'https://example.com/employment-past-v1.1.schema.json',
                },
              ],
              group: ['A'],
            },
            {
              id: 'OpenBadge',
              name: 'Badges',
              schema: [
                {
                  uri: 'https://example.com/open-badge-credential.schema.json',
                },
              ],
              group: ['B'],
            },
          ],
          submission_requirements: [
            {
              rule: 'all',
              from: 'A',
              min: 1,
            },
          ],
        },
        exp: expect.any(Number),
        iat: expect.any(Number),
        nbf: expect.any(Number),
        iss: tenant.did,
      });

      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(responsePayload.exchange_id) });
      expect(dbExchange).toEqual({
        _id: new ObjectId(responsePayload.exchange_id),
        type: ExchangeTypes.DISCLOSURE,
        tenantId: new ObjectId(tenant._id),
        disclosureId: new ObjectId(disclosure._id),
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
        events: [{ state: ExchangeStates.NEW, timestamp: expect.any(Date) }],
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
    it('should return 200 with stringified jwt if query parameter format is `json`', async () => {
      nockRegistrarGetOrganizationVerifiedProfile(
        tenant.did,
        sampleOrganizationVerifiedProfile1
      );
      nockRegistrarGetCredentialTypes();
      const q = { disclosureId: disclosure._id };
      const response = await fastify.injectJson({
        method: 'GET',
        url: inspectUrl(
          tenant.did,
          `/get-presentation-request?id=${q.disclosureId}&format=json`
        ),
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        presentation_request: expect.anything(),
      });
      const parsedResponse = response.json.presentation_request;

      expect(parsedResponse).toEqual({
        exchange_id: expect.any(String),
        metadata: {
          client_name: sampleOrganizationProfile1.name,
          logo_uri: sampleOrganizationProfile1.logo,
          tos_uri: disclosure.termsUrl,
          auth_token_uri: `${agentUrl}${tenantUrl(
            { tenantId: tenant.did },
            '/oauth/token'
          )}`,
          max_retention_period: disclosure.duration,
          progress_uri: `${agentUrl}${tenantUrl(
            { tenantId: tenant.did },
            '/get-exchange-progress'
          )}`,
          submit_presentation_uri: `${agentUrl}${inspectUrl(
            tenant.did,
            '/submit-presentation'
          )}`,
        },
        presentation_definition: {
          id: `${parsedResponse.exchange_id}.${disclosure._id}`,
          name: 'Clerk',
          purpose: disclosure.purpose,
          format: {
            jwt_vp: { alg: ['secp256k1'] },
          },
          input_descriptors: disclosure.types.map(
            ({ type }) => typesToInputDescriptors[type]
          ),
          submission_requirements: [
            {
              from: 'A',
              min: 1,
              rule: 'pick',
            },
          ],
        },
      });
    });
    it('should return 200 and ignore query parameter format `json` for production', async () => {
      await fastify.close();
      fastify = await buildFastify({ ...holderConfig, isProd: true });
      nockRegistrarGetOrganizationVerifiedProfile(
        tenant.did,
        sampleOrganizationVerifiedProfile1
      );
      nockRegistrarGetCredentialTypes();
      const q = { disclosureId: disclosure._id };
      const response = await fastify.injectJson({
        method: 'GET',
        url: inspectUrl(
          tenant.did,
          `/get-presentation-request?id=${q.disclosureId}&format=json`
        ),
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json.presentation_request).toEqual(
        expect.stringMatching(JWT_FORMAT)
      );
      await fastify.close();
      fastify = await buildFastify();
    });
    it('should 200 and include metadata commercialEntity fields if present on disclosure', async () => {
      disclosure = await persistDisclosure({
        tenant,
        vendorEndpoint: VendorEndpoint.RECEIVE_CHECKED_CREDENTIALS,
        commercialEntityName: 'fooCommercialEntityName',
        commercialEntityLogo: 'fooCommercialEntityLogo',
      });
      nockRegistrarGetOrganizationVerifiedProfile(
        tenant.did,
        sampleOrganizationVerifiedProfile1
      );
      nockRegistrarGetCredentialTypes();
      const q = { disclosureId: disclosure._id };
      const response = await fastify.injectJson({
        method: 'GET',
        url: inspectUrl(
          tenant.did,
          `/get-presentation-request?id=${q.disclosureId}`
        ),
      });
      expect(response.statusCode).toEqual(200);
      const { payload: responsePayload } = await jwtVerify(
        response.json.presentation_request,
        orgDidDoc.publicKey[0].publicKeyJwk
      );
      expect(responsePayload).toMatchSchema(presentationRequestSchema);
      expect(responsePayload).toEqual({
        exchange_id: expect.any(String),
        metadata: {
          client_name: 'fooCommercialEntityName',
          logo_uri: 'fooCommercialEntityLogo',
          tos_uri: disclosure.termsUrl,
          auth_token_uri: `${agentUrl}${tenantUrl(
            { tenantId: tenant.did },
            '/oauth/token'
          )}`,
          max_retention_period: disclosure.duration,
          progress_uri: `${agentUrl}${tenantUrl(
            { tenantId: tenant.did },
            '/get-exchange-progress'
          )}`,
          submit_presentation_uri: `${agentUrl}${inspectUrl(
            tenant.did,
            '/submit-presentation'
          )}`,
        },
        presentation_definition: {
          id: `${responsePayload.exchange_id}.${disclosure._id}`,
          name: disclosure.description,
          purpose: disclosure.purpose,
          format: {
            jwt_vp: { alg: ['secp256k1'] },
          },
          input_descriptors: disclosure.types.map(
            ({ type }) => typesToInputDescriptors[type]
          ),
          submission_requirements: [
            {
              from: 'A',
              min: 1,
              rule: 'pick',
            },
          ],
        },
        exp: expect.any(Number),
        iat: expect.any(Number),
        nbf: expect.any(Number),
        iss: tenant.did,
      });

      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(responsePayload.exchange_id) });
      expect(dbExchange).toEqual({
        _id: new ObjectId(responsePayload.exchange_id),
        type: ExchangeTypes.DISCLOSURE,
        tenantId: new ObjectId(tenant._id),
        disclosureId: new ObjectId(disclosure._id),
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
        events: [{ state: ExchangeStates.NEW, timestamp: expect.any(Date) }],
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
    it('should 200 and include metadata feed field if present on disclosure', async () => {
      disclosure = await persistDisclosure({
        tenant,
        feed: true,
      });
      nockRegistrarGetOrganizationVerifiedProfile(
        tenant.did,
        sampleOrganizationVerifiedProfile1
      );
      nockRegistrarGetCredentialTypes();

      const q = { disclosureId: disclosure._id };
      const response = await fastify.injectJson({
        method: 'GET',
        url: inspectUrl(
          tenant.did,
          `/get-presentation-request?id=${q.disclosureId}`
        ),
      });
      expect(response.statusCode).toEqual(200);
      const { payload: responsePayload } = await jwtVerify(
        response.json.presentation_request,
        orgDidDoc.publicKey[0].publicKeyJwk
      );
      expect(responsePayload).toMatchSchema(presentationRequestSchema);
      expect(responsePayload).toEqual({
        exchange_id: expect.any(String),
        metadata: {
          client_name: 'ACME Corp',
          logo_uri: 'https://example.com/logo.png',
          tos_uri: disclosure.termsUrl,
          auth_token_uri: `${agentUrl}${tenantUrl(
            { tenantId: tenant.did },
            '/oauth/token'
          )}`,
          max_retention_period: disclosure.duration,
          progress_uri: `${agentUrl}${tenantUrl(
            { tenantId: tenant.did },
            '/get-exchange-progress'
          )}`,
          submit_presentation_uri: `${agentUrl}${inspectUrl(
            tenant.did,
            '/submit-presentation'
          )}`,
          feed: true,
        },
        presentation_definition: {
          id: `${responsePayload.exchange_id}.${disclosure._id}`,
          name: disclosure.description,
          purpose: disclosure.purpose,
          format: {
            jwt_vp: { alg: ['secp256k1'] },
          },
          input_descriptors: disclosure.types.map(
            ({ type }) => typesToInputDescriptors[type]
          ),
          submission_requirements: [
            {
              from: 'A',
              min: 1,
              rule: 'pick',
            },
          ],
        },
        exp: expect.any(Number),
        iat: expect.any(Number),
        nbf: expect.any(Number),
        iss: tenant.did,
      });

      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(responsePayload.exchange_id) });
      expect(dbExchange).toEqual({
        _id: new ObjectId(responsePayload.exchange_id),
        type: ExchangeTypes.DISCLOSURE,
        tenantId: new ObjectId(tenant._id),
        disclosureId: new ObjectId(disclosure._id),
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
        events: [{ state: ExchangeStates.NEW, timestamp: expect.any(Date) }],
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
  });
});

const nockRegistrarGetCredentialTypes = () =>
  nock('http://oracle.localhost.test')
    .get(
      '/api/v0.6/credential-type-descriptors/PastEmploymentPosition?includeDisplay=false'
    )
    .reply(200, {
      id: 'PastEmploymentPosition',
      name: 'Past Role',
      schema: [
        {
          uri: 'http://oracle.localhost.test/schemas/PastEmploymentPosition.json',
        },
      ],
    })
    .get(
      '/api/v0.6/credential-type-descriptors/CurrentEmploymentPosition?includeDisplay=false'
    )
    .reply(200, {
      id: 'CurrentEmploymentPosition',
      name: 'Current Role',
      schema: [
        {
          uri: 'http://oracle.localhost.test/schemas/CurrentEmploymentPosition.json',
        },
      ],
    });
