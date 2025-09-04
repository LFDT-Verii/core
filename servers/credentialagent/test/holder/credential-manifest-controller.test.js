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

const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');

const { isEmpty, omit } = require('lodash/fp');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { ObjectId } = require('mongodb');
const nock = require('nock');
const qs = require('qs');
const { jwtDecode } = require('@verii/jwt');
const { generateKeyPair } = require('@verii/crypto');
const {
  sampleOrganizationProfile1,
  sampleOrganizationVerifiedProfile1,
  samplePresentationDefinition,
} = require('@verii/sample-data');
const { OBJECT_ID_FORMAT, JWT_FORMAT } = require('@verii/test-regexes');
const { mongoify, errorResponseMatcher } = require('@verii/tests-helpers');
const buildFastify = require('./helpers/credentialagent-holder-build-fastify');
const {
  nockRegistrarGetOrganizationVerifiedProfile,
} = require('../combined/helpers/nock-registrar-get-organization-verified-profile');
const {
  initOfferExchangeFactory,
  initTenantFactory,
  initKeysFactory,
  initDisclosureFactory,
  VendorEndpoint,
  ExchangeProtocols,
  ExchangeStates,
  ExchangeTypes,
} = require('../../src/entities');
const {
  nockRegistrarGetOrganizationDidDoc,
} = require('../combined/helpers/nock-registrar-get-organization-diddoc');
const { holderConfig } = require('../../src/config');

describe('get credential manifests', () => {
  let fastify;
  let persistTenant;
  let tenant;
  let persistKey;
  let exchange;
  let persistOfferExchange;
  let persistDisclosure;
  let disclosure;
  let orgDidDoc;
  let keyPair;

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();
    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistKey } = initKeysFactory(fastify));
    ({ persistOfferExchange } = initOfferExchangeFactory(fastify));
    ({ persistDisclosure } = initDisclosureFactory(fastify));
  });

  beforeEach(async () => {
    nock.cleanAll();
    fastify.resetOverrides();

    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});
    await mongoDb().collection('disclosures').deleteMany({});
    await mongoDb().collection('exchanges').deleteMany({});

    tenant = await persistTenant();
    const { publicKey } = generateKeyPair();
    orgDidDoc = {
      id: tenant.did,
      publicKey: [{ id: `${tenant.did}#key-1`, publicKeyHex: publicKey }],
      service: [
        {
          id: `${tenant.did}#service-1`,
          type: 'BasicProfileInformation',
          ...sampleOrganizationProfile1,
        },
      ],
    };

    nockRegistrarGetOrganizationDidDoc(orgDidDoc.id, orgDidDoc);
    keyPair = generateKeyPair({ format: 'jwk' });
    await persistKey({
      tenant,
      kidFragment: '#ID2',
      keyPair,
    });

    disclosure = await persistDisclosure({
      tenant,
      description: 'Credential Issuance disclosure',
      types: [{ type: 'EmailV1.0' }],
      vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
      purpose: 'Identification',
      duration: '6y',
    });
    exchange = await persistOfferExchange({ tenant, disclosure });

    nockRegistrarGetOrganizationDidDoc(orgDidDoc.id, orgDidDoc);
  });

  after(async () => {
    nock.cleanAll();
    nock.restore();
    await fastify.close();
  });

  const agentUrl = 'http://localhost.test';
  const tenantUrl = ({ tenantId, queryParams }, suffix) => {
    const baseUrl = `/api/holder/v0.6/org/${tenantId}${suffix}`;
    if (isEmpty(queryParams)) {
      return baseUrl;
    }
    const queryString = qs.stringify(queryParams, { indices: false });
    return `${baseUrl}?${queryString}`;
  };

  const issuingUrl = (tenantId, suffix = '', queryParams) =>
    tenantUrl({ tenantId, queryParams }, `/issue${suffix}`);

  describe('get-credential-manifest', () => {
    it('should 404 when disclosureId cant be found', async () => {
      const tenant2 = await persistTenant({
        kid: 'ID3',
        key: 'KEY3',
      });

      const response = await fastify.injectJson({
        method: 'GET',
        url: issuingUrl(tenant2.did, '/get-credential-manifest', {
          credential_types: 'PastEmploymentPosition',
        }),
      });

      expect(response.statusCode).toEqual(404);
    });

    it('should 404 when an exchangeId contains a unknown disclosureId', async () => {
      const customExchange = await persistOfferExchange({
        tenant,
        disclosure: { _id: new ObjectId() },
      });

      const response = await fastify.injectJson({
        method: 'GET',
        url: issuingUrl(tenant.did, '/get-credential-manifest', {
          exchange_id: customExchange._id,
          credential_types: ['PastEmploymentPosition'],
        }),
      });

      expect(response.statusCode).toEqual(404);
    });

    it('should 500 if tenant doesnt have a private key defined', async () => {
      const nonDidTenant = await persistTenant();
      const nonDisclosure = await persistDisclosure({
        tenant: nonDidTenant,
        description: 'Credential Issuance disclosure',
        types: [{ type: 'EmailV1.0' }],
        vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
        purpose: 'Identification',
        duration: '6y',
      });

      nockRegistrarGetOrganizationDidDoc(nonDidTenant.did, orgDidDoc);
      nockRegistrarGetOrganizationVerifiedProfile(
        nonDidTenant.did,
        sampleOrganizationVerifiedProfile1
      );

      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/EmailV1.0?includeDisplay=false'
        )
        .reply(200, {
          id: 'EmailV1.0',
          name: 'Email',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/Email.json',
            },
          ],
          display: {
            title: {
              path: '$.email',
            },
          },
        });
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/PastEmploymentPosition?includeDisplay=true'
        )
        .reply(200, {
          id: 'PastEmploymentPosition',
          name: 'Past Role',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/PastEmploymentPosition.json',
            },
          ],
          display: {
            title: {
              path: '$.employment',
            },
          },
        });
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/CurrentEmploymentPosition?includeDisplay=true'
        )
        .reply(200, {
          id: 'CurrentEmploymentPosition',
          name: 'Current Role',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/CurrentEmploymentPosition.json',
            },
          ],
          display: {
            title: {
              path: '$.current',
            },
          },
        });

      const response = await fastify.injectJson({
        method: 'GET',
        url: issuingUrl(nonDidTenant.did, '/get-credential-manifest', {
          credential_types: [
            'PastEmploymentPosition',
            'CurrentEmploymentPosition',
          ],
        }),
      });
      expect(response.statusCode).toEqual(500);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Internal Server Error',
          errorCode: 'tenant_exchanges_key_missing',
          message: `No key matching the filter {"tenantId":"${nonDidTenant._id.toString()}","purposes":"EXCHANGES"} was found`,
          statusCode: 500,
        })
      );

      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ tenantId: new ObjectId(nonDidTenant._id) });
      expect(dbExchange).toEqual({
        _id: expect.any(ObjectId),
        type: ExchangeTypes.ISSUING,
        credentialTypes: [
          'PastEmploymentPosition',
          'CurrentEmploymentPosition',
        ],
        disclosureId: new ObjectId(nonDisclosure._id),
        events: [
          { state: ExchangeStates.NEW, timestamp: expect.any(Date) },
          {
            state: ExchangeStates.CREDENTIAL_MANIFEST_REQUESTED,
            timestamp: expect.any(Date),
          },

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

    it('should 500 when the credential type descriptor retrieval fails', async () => {
      nockRegistrarGetOrganizationVerifiedProfile(
        tenant.did,
        sampleOrganizationVerifiedProfile1
      );

      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/EmailV1.0?includeDisplay=false'
        )
        .reply(200, {
          id: 'EmailV1.0',
          name: 'Email',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/Email.json',
            },
          ],
          display: {
            title: {
              path: '$.email',
            },
          },
        });
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/PastEmploymentPosition?includeDisplay=true'
        )
        .reply(403, {});

      const response = await fastify.injectJson({
        method: 'GET',
        url: issuingUrl(tenant.did, '/get-credential-manifest', {
          credential_types: ['PastEmploymentPosition'],
          exchange_id: exchange._id,
        }),
      });
      expect(response.statusCode).toEqual(502);

      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ tenantId: new ObjectId(tenant._id) });
      expect(dbExchange).toEqual({
        _id: expect.any(ObjectId),
        type: ExchangeTypes.ISSUING,
        credentialTypes: ['PastEmploymentPosition'],
        disclosureId: new ObjectId(disclosure._id),
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
        events: [
          { state: ExchangeStates.NEW, timestamp: expect.any(Date) },
          {
            state: ExchangeStates.CREDENTIAL_MANIFEST_REQUESTED,
            timestamp: expect.any(Date),
          },
          {
            state: ExchangeStates.UNEXPECTED_ERROR,
            timestamp: expect.any(Date),
          },
        ],
        offerHashes: [],
        err: expect.any(String),
        tenantId: new ObjectId(tenant._id),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should 400 when exchange is already completed', async () => {
      const customExchange = await persistOfferExchange({
        tenant,
        disclosure,
        events: [
          { state: ExchangeStates.NEW, timestamp: new Date() },
          {
            state: ExchangeStates.COMPLETE,
            timestamp: new Date(),
          },
          {
            state: ExchangeStates.OFFERS_SENT,
            timestamp: new Date(),
          },
        ],
      });

      const response = await fastify.injectJson({
        method: 'GET',
        url: issuingUrl(tenant.did, '/get-credential-manifest', {
          exchange_id: customExchange._id,
          credential_types: ['PastEmploymentPosition'],
        }),
      });

      expect(response.statusCode).toEqual(400);
      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(customExchange._id) });
      expect(dbExchange).toEqual({
        _id: expect.any(ObjectId),
        type: ExchangeTypes.ISSUING,
        credentialTypes: ['PastEmploymentPosition'],
        disclosureId: new ObjectId(disclosure._id),
        events: [
          { state: ExchangeStates.NEW, timestamp: expect.any(Date) },
          {
            state: ExchangeStates.COMPLETE,
            timestamp: expect.any(Date),
          },
          {
            state: ExchangeStates.OFFERS_SENT,
            timestamp: expect.any(Date),
          },
          {
            state: ExchangeStates.CREDENTIAL_MANIFEST_REQUESTED,
            timestamp: expect.any(Date),
          },
          {
            state: ExchangeStates.UNEXPECTED_ERROR,
            timestamp: expect.any(Date),
          },
        ],
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
        offerHashes: [],
        err: expect.any(String),
        tenantId: new ObjectId(tenant._id),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should 400 when disclosure deactivated', async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        enableDeactivatedDisclosure: true,
      });

      const customDisclosure = await persistDisclosure({
        tenant,
        deactivationDate: '2000-12-01T00:00:00.000Z',
      });
      const customExchange = await persistOfferExchange({
        tenant,
        disclosure: customDisclosure,
        events: [{ state: ExchangeStates.NEW, timestamp: new Date() }],
      });

      const response = await fastify.injectJson({
        method: 'GET',
        url: issuingUrl(tenant.did, '/get-credential-manifest', {
          exchange_id: customExchange._id,
          id: customDisclosure._id,
          credential_types: ['PastEmploymentPosition'],
        }),
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'disclosure_not_active',
          message: 'Disclosure is not active',
          statusCode: 400,
        })
      );
    });

    it('should 400 when default issuing disclosure deactivated', async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        enableDeactivatedDisclosure: true,
      });

      const customDisclosure = await persistDisclosure({
        tenant,
        deactivationDate: '2000-12-01T00:00:00.000Z',
      });
      await mongoDb()
        .collection('tenants')
        .updateOne(
          {
            _id: new ObjectId(tenant._id),
          },
          {
            $set: {
              defaultIssuingDisclosureId: new ObjectId(customDisclosure._id),
            },
          }
        );

      const response = await fastify.injectJson({
        method: 'GET',
        url: issuingUrl(tenant.did, '/get-credential-manifest', {
          credential_types: ['PastEmploymentPosition'],
        }),
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'disclosure_not_active',
          message: 'Disclosure is not active',
          statusCode: 400,
        })
      );
    });

    it('should 404 when a bad exchangeId is passed', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: issuingUrl(tenant.did, '/get-credential-manifest', {
          exchange_id: 'no-exchange-id',
          credential_types: [
            'PastEmploymentPosition',
            'CurrentEmploymentPosition',
          ],
        }),
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'exchange_not_found',
          message: 'Exchange no-exchange-id not found',
          statusCode: 404,
        })
      );
    });

    it('should 200, when types provided but no exchangeId, no disclosureId', async () => {
      nockRegistrarGetOrganizationVerifiedProfile(
        tenant.did,
        sampleOrganizationVerifiedProfile1
      );
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/EmailV1.0?includeDisplay=false'
        )
        .reply(200, {
          id: 'EmailV1.0',
          name: 'Email',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/Email.json',
            },
          ],
        });
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/PastEmploymentPosition?includeDisplay=true'
        )
        .reply(200, {
          id: 'PastEmploymentPosition',
          name: 'Past Role',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/PastEmploymentPosition.json',
            },
          ],
          display: {
            title: {
              path: '$.employment',
            },
          },
        });
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/CurrentEmploymentPosition?includeDisplay=true'
        )
        .reply(200, {
          id: 'CurrentEmploymentPosition',
          name: 'Current Role',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/CurrentEmploymentPosition.json',
            },
          ],
          display: {
            title: {
              path: '$.current',
            },
          },
        });

      const response = await fastify.injectJson({
        method: 'GET',
        url: issuingUrl(tenant.did, '/get-credential-manifest', {
          credential_types: [
            'PastEmploymentPosition',
            'CurrentEmploymentPosition',
          ],
        }),
        headers: {
          origin: 'foo',
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.headers['access-control-allow-origin']).toEqual('foo');
      expect(response.json).toEqual({
        issuing_request: expect.any(String),
      });
      const { payload } = jwtDecode(response.json.issuing_request);
      expect(payload).toEqual({
        exchange_id: expect.stringMatching(OBJECT_ID_FORMAT),
        output_descriptors: [
          {
            id: 'PastEmploymentPosition',
            name: 'Past Role',
            schema: [
              {
                uri: 'http://oracle.localhost.test/schemas/PastEmploymentPosition.json',
              },
            ],
            display: {
              title: {
                path: '$.employment',
              },
            },
          },
          {
            id: 'CurrentEmploymentPosition',
            name: 'Current Role',
            schema: [
              {
                uri: 'http://oracle.localhost.test/schemas/CurrentEmploymentPosition.json',
              },
            ],
            display: {
              title: {
                path: '$.current',
              },
            },
          },
        ],
        issuer: {
          id: tenant.did,
        },
        presentation_definition: {
          id: `${payload.exchange_id}.${disclosure._id}`,
          name: disclosure.description,
          purpose: 'Identification',
          format: { jwt_vp: { alg: ['secp256k1'] } },
          input_descriptors: [
            {
              id: 'EmailV1.0',
              name: 'Email',
              group: ['A'],
              schema: [
                {
                  uri: 'http://oracle.localhost.test/schemas/Email.json',
                },
              ],
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
          submit_presentation_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/submit-identification'
          )}`,
          check_offers_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/credential-offers'
          )}`,
          finalize_offers_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/finalize-offers'
          )}`,
        },
        iss: tenant.did,
        iat: expect.any(Number),
        exp: expect.any(Number),
        nbf: expect.any(Number),
      });
      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(payload.exchange_id) });
      expect(dbExchange).toEqual({
        _id: new ObjectId(payload.exchange_id),
        type: ExchangeTypes.ISSUING,
        tenantId: new ObjectId(tenant._id),
        disclosureId: new ObjectId(disclosure._id),
        events: [
          { state: ExchangeStates.NEW, timestamp: expect.any(Date) },
          {
            state: ExchangeStates.CREDENTIAL_MANIFEST_REQUESTED,
            timestamp: expect.any(Date),
          },
        ],
        credentialTypes: [
          'PastEmploymentPosition',
          'CurrentEmploymentPosition',
        ],
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should 200, when a disclosureId, no exchangeId nor types are passed', async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        enableDeactivatedDisclosure: true,
      });

      const customDisclosure = await persistDisclosure({
        tenant,
        description: 'Integrated Credential Issuance disclosure',
        types: [{ type: 'EmailV1.0' }],
        vendorEndpoint: VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION,
        purpose: 'Identification',
        deactivationDate: '2025-12-01T00:00:00.000Z',
        duration: '6y',
      });
      nockRegistrarGetOrganizationVerifiedProfile(
        tenant.did,
        sampleOrganizationVerifiedProfile1
      );
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/EmailV1.0?includeDisplay=false'
        )
        .reply(200, {
          id: 'EmailV1.0',
          name: 'Email',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/Email.json',
            },
          ],
        });
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/PastEmploymentPosition?includeDisplay=true'
        )
        .reply(200, {
          id: 'PastEmploymentPosition',
          name: 'Past Role',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/PastEmploymentPosition.json',
            },
          ],
          display: {
            title: {
              path: '$.employment',
            },
          },
        });

      const response = await fastify.injectJson({
        method: 'GET',
        url: issuingUrl(tenant.did, '/get-credential-manifest', {
          id: customDisclosure._id,
          credential_types: ['PastEmploymentPosition'],
        }),
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        issuing_request: expect.any(String),
      });
      const { payload } = jwtDecode(response.json.issuing_request);
      expect(payload).toEqual({
        exchange_id: expect.any(String),
        output_descriptors: [
          {
            id: 'PastEmploymentPosition',
            name: 'Past Role',
            schema: [
              {
                uri: 'http://oracle.localhost.test/schemas/PastEmploymentPosition.json',
              },
            ],
            display: {
              title: {
                path: '$.employment',
              },
            },
          },
        ],
        issuer: {
          id: tenant.did,
        },
        presentation_definition: {
          id: `${payload.exchange_id}.${customDisclosure._id}`,
          name: customDisclosure.description,
          purpose: customDisclosure.purpose,
          format: {
            jwt_vp: { alg: ['secp256k1'] },
          },
          input_descriptors: [
            {
              id: 'EmailV1.0',
              name: 'Email',
              group: ['A'],
              schema: [
                {
                  uri: 'http://oracle.localhost.test/schemas/Email.json',
                },
              ],
            },
          ],
          submission_requirements: [
            {
              from: 'A',
              min: 1,
              rule: 'all',
            },
          ],
        },
        metadata: {
          client_name: orgDidDoc.service[0].name,
          logo_uri: orgDidDoc.service[0].logo,
          tos_uri: customDisclosure.termsUrl,
          auth_token_uri: `${agentUrl}${tenantUrl(
            { tenantId: tenant.did },
            '/oauth/token'
          )}`,
          max_retention_period: customDisclosure.duration,
          progress_uri: `${agentUrl}${tenantUrl(
            { tenantId: tenant.did },
            '/get-exchange-progress'
          )}`,
          submit_presentation_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/submit-identification'
          )}`,
          check_offers_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/credential-offers'
          )}`,
          finalize_offers_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/finalize-offers'
          )}`,
        },
        iss: tenant.did,
        exp: expect.any(Number),
        iat: expect.any(Number),
        nbf: expect.any(Number),
      });
      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ disclosureId: new ObjectId(customDisclosure._id) });
      expect(dbExchange).toEqual(
        expect.objectContaining({
          ...mongoify({
            protocolMetadata: {
              protocol: ExchangeProtocols.VNF_API,
            },
            events: expect.arrayContaining([
              {
                state: ExchangeStates.CREDENTIAL_MANIFEST_REQUESTED,
                timestamp: expect.any(Date),
              },
            ]),
            tenantId: tenant._id,
            updatedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should 200, when route has a tenantId', async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        enableDeactivatedDisclosure: true,
      });

      const customDisclosure = await persistDisclosure({
        tenant,
        description: 'Integrated Credential Issuance disclosure',
        types: [{ type: 'EmailV1.0' }],
        vendorEndpoint: VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION,
        purpose: 'Identification',
        deactivationDate: '2025-12-01T00:00:00.000Z',
        duration: '6y',
      });
      nockRegistrarGetOrganizationVerifiedProfile(
        tenant.did,
        sampleOrganizationVerifiedProfile1
      );
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/EmailV1.0?includeDisplay=false'
        )
        .reply(200, {
          id: 'EmailV1.0',
          name: 'Email',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/Email.json',
            },
          ],
        });
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/PastEmploymentPosition?includeDisplay=true'
        )
        .reply(200, {
          id: 'PastEmploymentPosition',
          name: 'Past Role',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/PastEmploymentPosition.json',
            },
          ],
          display: {
            title: {
              path: '$.employment',
            },
          },
        });

      const response = await fastify.injectJson({
        method: 'GET',
        url: issuingUrl(tenant._id, '/get-credential-manifest', {
          id: customDisclosure._id,
          credential_types: ['PastEmploymentPosition'],
        }),
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        issuing_request: expect.any(String),
      });
      const { payload } = jwtDecode(response.json.issuing_request);
      expect(payload).toEqual({
        exchange_id: expect.any(String),
        output_descriptors: [
          {
            id: 'PastEmploymentPosition',
            name: 'Past Role',
            schema: [
              {
                uri: 'http://oracle.localhost.test/schemas/PastEmploymentPosition.json',
              },
            ],
            display: {
              title: {
                path: '$.employment',
              },
            },
          },
        ],
        issuer: {
          id: tenant.did,
        },
        presentation_definition: {
          id: `${payload.exchange_id}.${customDisclosure._id}`,
          name: customDisclosure.description,
          purpose: customDisclosure.purpose,
          format: {
            jwt_vp: { alg: ['secp256k1'] },
          },
          input_descriptors: [
            {
              id: 'EmailV1.0',
              name: 'Email',
              group: ['A'],
              schema: [
                {
                  uri: 'http://oracle.localhost.test/schemas/Email.json',
                },
              ],
            },
          ],
          submission_requirements: [
            {
              from: 'A',
              min: 1,
              rule: 'all',
            },
          ],
        },
        metadata: {
          client_name: orgDidDoc.service[0].name,
          logo_uri: orgDidDoc.service[0].logo,
          tos_uri: customDisclosure.termsUrl,
          auth_token_uri: `${agentUrl}${tenantUrl(
            { tenantId: tenant.did },
            '/oauth/token'
          )}`,
          max_retention_period: customDisclosure.duration,
          progress_uri: `${agentUrl}${tenantUrl(
            { tenantId: tenant.did },
            '/get-exchange-progress'
          )}`,
          submit_presentation_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/submit-identification'
          )}`,
          check_offers_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/credential-offers'
          )}`,
          finalize_offers_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/finalize-offers'
          )}`,
        },
        iss: tenant.did,
        exp: expect.any(Number),
        iat: expect.any(Number),
        nbf: expect.any(Number),
      });
      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ disclosureId: new ObjectId(customDisclosure._id) });
      expect(dbExchange).toEqual(
        expect.objectContaining({
          ...mongoify({
            protocolMetadata: {
              protocol: ExchangeProtocols.VNF_API,
            },
            events: expect.arrayContaining([
              {
                state: ExchangeStates.CREDENTIAL_MANIFEST_REQUESTED,
                timestamp: expect.any(Date),
              },
            ]),
            tenantId: tenant._id,
            updatedAt: expect.any(Date),
          }),
        })
      );
    });

    it("should 200, when route has a tenant's did alias", async () => {
      const didAlias = 'did:aka:foo';
      const customTenant = await persistTenant({ dids: [didAlias] });
      const { publicKey } = generateKeyPair();
      const customOrgDidDoc = {
        id: customTenant.did,
        publicKey: [
          { id: `${customTenant.did}#key-1`, publicKeyHex: publicKey },
        ],
        service: [
          {
            id: `${customTenant.did}#service-1`,
            type: 'BasicProfileInformation',
            ...sampleOrganizationProfile1,
          },
        ],
      };

      nockRegistrarGetOrganizationDidDoc(customOrgDidDoc.id, customOrgDidDoc);

      await persistKey({
        tenant: customTenant,
        kidFragment: '#ID2',
        keyPair,
      });

      const customDisclosure = await persistDisclosure({
        tenant: customTenant,
        description: 'Integrated Credential Issuance disclosure',
        types: [{ type: 'EmailV1.0' }],
        vendorEndpoint: VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION,
        purpose: 'Identification',
        duration: '6y',
      });
      nockRegistrarGetOrganizationVerifiedProfile(
        customTenant.did,
        sampleOrganizationVerifiedProfile1
      );
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/EmailV1.0?includeDisplay=false'
        )
        .reply(200, {
          id: 'EmailV1.0',
          name: 'Email',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/Email.json',
            },
          ],
        });

      const response = await fastify.injectJson({
        method: 'GET',
        url: issuingUrl(didAlias, '/get-credential-manifest'),
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        issuing_request: expect.any(String),
      });
      const { payload } = jwtDecode(response.json.issuing_request);
      expect(payload).toEqual({
        exchange_id: expect.any(String),
        output_descriptors: [],
        issuer: {
          id: customTenant.did,
        },
        presentation_definition: {
          id: `${payload.exchange_id}.${customDisclosure._id}`,
          name: customDisclosure.description,
          purpose: customDisclosure.purpose,
          format: {
            jwt_vp: { alg: ['secp256k1'] },
          },
          input_descriptors: [
            {
              id: 'EmailV1.0',
              name: 'Email',
              group: ['A'],
              schema: [
                {
                  uri: 'http://oracle.localhost.test/schemas/Email.json',
                },
              ],
            },
          ],
          submission_requirements: [
            {
              from: 'A',
              min: 1,
              rule: 'all',
            },
          ],
        },
        metadata: {
          client_name: orgDidDoc.service[0].name,
          logo_uri: orgDidDoc.service[0].logo,
          tos_uri: customDisclosure.termsUrl,
          auth_token_uri: `${agentUrl}${tenantUrl(
            { tenantId: customTenant.did },
            '/oauth/token'
          )}`,
          max_retention_period: customDisclosure.duration,
          progress_uri: `${agentUrl}${tenantUrl(
            { tenantId: customTenant.did },
            '/get-exchange-progress'
          )}`,
          submit_presentation_uri: `${agentUrl}${issuingUrl(
            customTenant.did,
            '/submit-identification'
          )}`,
          check_offers_uri: `${agentUrl}${issuingUrl(
            customTenant.did,
            '/credential-offers'
          )}`,
          finalize_offers_uri: `${agentUrl}${issuingUrl(
            customTenant.did,
            '/finalize-offers'
          )}`,
        },
        iss: customTenant.did,
        exp: expect.any(Number),
        iat: expect.any(Number),
        nbf: expect.any(Number),
      });
      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ disclosureId: new ObjectId(customDisclosure._id) });
      expect(dbExchange).toEqual(
        expect.objectContaining({
          ...mongoify({
            protocolMetadata: {
              protocol: ExchangeProtocols.VNF_API,
            },
            events: expect.arrayContaining([
              {
                state: ExchangeStates.CREDENTIAL_MANIFEST_REQUESTED,
                timestamp: expect.any(Date),
              },
            ]),
            tenantId: customTenant._id,
            updatedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should 200, when disclosureId is passed and disclosure has a presentationDefinition without purpose', async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        enableDeactivatedDisclosure: true,
      });

      const customDisclosure = await persistDisclosure({
        tenant,
        description: 'Integrated Credential Issuance disclosure',
        vendorEndpoint: VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION,
        purpose: 'fooPurpose from disclosure',
        deactivationDate: '2025-12-01T00:00:00.000Z',
        duration: '6y',
        presentationDefinition: omit(['purpose'], samplePresentationDefinition),
      });
      nockRegistrarGetOrganizationVerifiedProfile(
        tenant.did,
        sampleOrganizationVerifiedProfile1
      );
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/EmailV1.0?includeDisplay=false'
        )
        .reply(200, {
          id: 'EmailV1.0',
          name: 'Email',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/Email.json',
            },
          ],
        });
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/PastEmploymentPosition?includeDisplay=true'
        )
        .reply(200, {
          id: 'PastEmploymentPosition',
          name: 'Past Role',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/PastEmploymentPosition.json',
            },
          ],
          display: {
            title: {
              path: '$.employment',
            },
          },
        });

      const response = await fastify.injectJson({
        method: 'GET',
        url: issuingUrl(tenant.did, '/get-credential-manifest', {
          id: customDisclosure._id,
          credential_types: ['PastEmploymentPosition'],
        }),
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        issuing_request: expect.any(String),
      });
      const { payload } = jwtDecode(response.json.issuing_request);
      expect(payload).toEqual({
        exchange_id: expect.any(String),
        output_descriptors: [
          {
            id: 'PastEmploymentPosition',
            name: 'Past Role',
            schema: [
              {
                uri: 'http://oracle.localhost.test/schemas/PastEmploymentPosition.json',
              },
            ],
            display: {
              title: {
                path: '$.employment',
              },
            },
          },
        ],
        issuer: {
          id: tenant.did,
        },
        presentation_definition: {
          id: `${payload.exchange_id}.${customDisclosure._id}`,
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
        metadata: {
          client_name: orgDidDoc.service[0].name,
          logo_uri: orgDidDoc.service[0].logo,
          tos_uri: customDisclosure.termsUrl,
          auth_token_uri: `${agentUrl}${tenantUrl(
            { tenantId: tenant.did },
            '/oauth/token'
          )}`,
          max_retention_period: customDisclosure.duration,
          progress_uri: `${agentUrl}${tenantUrl(
            { tenantId: tenant.did },
            '/get-exchange-progress'
          )}`,
          submit_presentation_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/submit-identification'
          )}`,
          check_offers_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/credential-offers'
          )}`,
          finalize_offers_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/finalize-offers'
          )}`,
        },
        iss: tenant.did,
        exp: expect.any(Number),
        iat: expect.any(Number),
        nbf: expect.any(Number),
      });
      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ disclosureId: new ObjectId(customDisclosure._id) });
      expect(dbExchange).toEqual(
        expect.objectContaining({
          ...mongoify({
            protocolMetadata: {
              protocol: ExchangeProtocols.VNF_API,
            },
            events: expect.arrayContaining([
              {
                state: ExchangeStates.CREDENTIAL_MANIFEST_REQUESTED,
                timestamp: expect.any(Date),
              },
            ]),
            tenantId: tenant._id,
            updatedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should 200, when disclosureId is passed and disclosure has a presentationDefinition with purpose', async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        enableDeactivatedDisclosure: true,
      });

      const customDisclosure = await persistDisclosure({
        tenant,
        description: 'Integrated Credential Issuance disclosure',
        vendorEndpoint: VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION,
        purpose: 'Identification',
        deactivationDate: '2025-12-01T00:00:00.000Z',
        duration: '6y',
        presentationDefinition: {
          ...samplePresentationDefinition,
          purpose: 'fooPurpose',
        },
      });
      nockRegistrarGetOrganizationVerifiedProfile(
        tenant.did,
        sampleOrganizationVerifiedProfile1
      );
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/EmailV1.0?includeDisplay=false'
        )
        .reply(200, {
          id: 'EmailV1.0',
          name: 'Email',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/Email.json',
            },
          ],
        });
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/PastEmploymentPosition?includeDisplay=true'
        )
        .reply(200, {
          id: 'PastEmploymentPosition',
          name: 'Past Role',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/PastEmploymentPosition.json',
            },
          ],
          display: {
            title: {
              path: '$.employment',
            },
          },
        });

      const response = await fastify.injectJson({
        method: 'GET',
        url: issuingUrl(tenant.did, '/get-credential-manifest', {
          id: customDisclosure._id,
          credential_types: ['PastEmploymentPosition'],
        }),
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        issuing_request: expect.any(String),
      });
      const { payload } = jwtDecode(response.json.issuing_request);
      expect(payload).toEqual({
        exchange_id: expect.any(String),
        output_descriptors: [
          {
            id: 'PastEmploymentPosition',
            name: 'Past Role',
            schema: [
              {
                uri: 'http://oracle.localhost.test/schemas/PastEmploymentPosition.json',
              },
            ],
            display: {
              title: {
                path: '$.employment',
              },
            },
          },
        ],
        issuer: {
          id: tenant.did,
        },
        presentation_definition: {
          id: `${payload.exchange_id}.${customDisclosure._id}`,
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
        metadata: {
          client_name: orgDidDoc.service[0].name,
          logo_uri: orgDidDoc.service[0].logo,
          tos_uri: customDisclosure.termsUrl,
          auth_token_uri: `${agentUrl}${tenantUrl(
            { tenantId: tenant.did },
            '/oauth/token'
          )}`,
          max_retention_period: customDisclosure.duration,
          progress_uri: `${agentUrl}${tenantUrl(
            { tenantId: tenant.did },
            '/get-exchange-progress'
          )}`,
          submit_presentation_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/submit-identification'
          )}`,
          check_offers_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/credential-offers'
          )}`,
          finalize_offers_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/finalize-offers'
          )}`,
        },
        iss: tenant.did,
        exp: expect.any(Number),
        iat: expect.any(Number),
        nbf: expect.any(Number),
      });
      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ disclosureId: new ObjectId(customDisclosure._id) });
      expect(dbExchange).toEqual(
        expect.objectContaining({
          ...mongoify({
            protocolMetadata: {
              protocol: ExchangeProtocols.VNF_API,
            },
            events: expect.arrayContaining([
              {
                state: ExchangeStates.CREDENTIAL_MANIFEST_REQUESTED,
                timestamp: expect.any(Date),
              },
            ]),
            tenantId: tenant._id,
            updatedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should 200, when disclosureId and include disclosure commercial entity data in issuing request', async () => {
      const customDisclosure = await persistDisclosure({
        tenant,
        types: [{ type: 'EmailV1.0' }],
        vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
        purpose: 'Identification',
        commercialEntityName: 'fooCommercialEntityName',
        commercialEntityLogo: 'fooCommercialEntityLogo',
      });
      nockRegistrarGetOrganizationVerifiedProfile(
        tenant.did,
        sampleOrganizationVerifiedProfile1
      );
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/EmailV1.0?includeDisplay=false'
        )
        .reply(200, {
          id: 'EmailV1.0',
          name: 'Email',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/Email.json',
            },
          ],
        });

      const response = await fastify.injectJson({
        method: 'GET',
        url: issuingUrl(tenant.did, '/get-credential-manifest', {
          id: customDisclosure._id,
        }),
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        issuing_request: expect.any(String),
      });
      const { payload } = jwtDecode(response.json.issuing_request);
      expect(payload).toEqual({
        exchange_id: expect.any(String),
        output_descriptors: [],
        issuer: {
          id: tenant.did,
        },
        presentation_definition: {
          id: `${payload.exchange_id}.${customDisclosure._id}`,
          name: customDisclosure.description,
          purpose: customDisclosure.purpose,
          format: {
            jwt_vp: { alg: ['secp256k1'] },
          },
          input_descriptors: [
            {
              id: 'EmailV1.0',
              name: 'Email',
              group: ['A'],
              schema: [
                {
                  uri: 'http://oracle.localhost.test/schemas/Email.json',
                },
              ],
            },
          ],
          submission_requirements: [
            {
              from: 'A',
              min: 1,
              rule: 'all',
            },
          ],
        },
        metadata: {
          client_name: 'fooCommercialEntityName',
          logo_uri: 'fooCommercialEntityLogo',
          tos_uri: customDisclosure.termsUrl,
          auth_token_uri: `${agentUrl}${tenantUrl(
            { tenantId: tenant.did },
            '/oauth/token'
          )}`,
          max_retention_period: customDisclosure.duration,
          progress_uri: `${agentUrl}${tenantUrl(
            { tenantId: tenant.did },
            '/get-exchange-progress'
          )}`,
          submit_presentation_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/submit-identification'
          )}`,
          check_offers_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/credential-offers'
          )}`,
          finalize_offers_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/finalize-offers'
          )}`,
        },
        iss: tenant.did,
        exp: expect.any(Number),
        iat: expect.any(Number),
        nbf: expect.any(Number),
      });
      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ disclosureId: new ObjectId(customDisclosure._id) });
      expect(dbExchange).toEqual(
        expect.objectContaining({
          ...mongoify({
            protocolMetadata: {
              protocol: ExchangeProtocols.VNF_API,
            },
            events: expect.arrayContaining([
              {
                state: ExchangeStates.CREDENTIAL_MANIFEST_REQUESTED,
                timestamp: expect.any(Date),
              },
            ]),
            tenantId: tenant._id,
            updatedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should 200, when no disclosureId, no exchangeId nor types are passed', async () => {
      const customTenant = await persistTenant();
      const { publicKey } = generateKeyPair();
      const customOrgDidDoc = {
        id: customTenant.did,
        publicKey: [
          { id: `${customTenant.did}#key-1`, publicKeyHex: publicKey },
        ],
        service: [
          {
            id: `${customTenant.did}#service-1`,
            type: 'BasicProfileInformation',
            ...sampleOrganizationProfile1,
          },
        ],
      };

      nockRegistrarGetOrganizationDidDoc(customOrgDidDoc.id, customOrgDidDoc);

      await persistKey({
        tenant: customTenant,
        kidFragment: '#ID2',
        keyPair,
      });

      const customDisclosure = await persistDisclosure({
        tenant: customTenant,
        description: 'Integrated Credential Issuance disclosure',
        types: [{ type: 'EmailV1.0' }],
        vendorEndpoint: VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION,
        purpose: 'Identification',
        duration: '6y',
      });
      nockRegistrarGetOrganizationVerifiedProfile(
        customTenant.did,
        sampleOrganizationVerifiedProfile1
      );
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/EmailV1.0?includeDisplay=false'
        )
        .reply(200, {
          id: 'EmailV1.0',
          name: 'Email',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/Email.json',
            },
          ],
        });

      const response = await fastify.injectJson({
        method: 'GET',
        url: issuingUrl(customTenant.did, '/get-credential-manifest'),
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        issuing_request: expect.any(String),
      });
      const { payload } = jwtDecode(response.json.issuing_request);
      expect(payload).toEqual({
        exchange_id: expect.any(String),
        output_descriptors: [],
        issuer: {
          id: customTenant.did,
        },
        presentation_definition: {
          id: `${payload.exchange_id}.${customDisclosure._id}`,
          name: customDisclosure.description,
          purpose: customDisclosure.purpose,
          format: {
            jwt_vp: { alg: ['secp256k1'] },
          },
          input_descriptors: [
            {
              id: 'EmailV1.0',
              name: 'Email',
              group: ['A'],
              schema: [
                {
                  uri: 'http://oracle.localhost.test/schemas/Email.json',
                },
              ],
            },
          ],
          submission_requirements: [
            {
              from: 'A',
              min: 1,
              rule: 'all',
            },
          ],
        },
        metadata: {
          client_name: orgDidDoc.service[0].name,
          logo_uri: orgDidDoc.service[0].logo,
          tos_uri: customDisclosure.termsUrl,
          auth_token_uri: `${agentUrl}${tenantUrl(
            { tenantId: customTenant.did },
            '/oauth/token'
          )}`,
          max_retention_period: customDisclosure.duration,
          progress_uri: `${agentUrl}${tenantUrl(
            { tenantId: customTenant.did },
            '/get-exchange-progress'
          )}`,
          submit_presentation_uri: `${agentUrl}${issuingUrl(
            customTenant.did,
            '/submit-identification'
          )}`,
          check_offers_uri: `${agentUrl}${issuingUrl(
            customTenant.did,
            '/credential-offers'
          )}`,
          finalize_offers_uri: `${agentUrl}${issuingUrl(
            customTenant.did,
            '/finalize-offers'
          )}`,
        },
        iss: customTenant.did,
        exp: expect.any(Number),
        iat: expect.any(Number),
        nbf: expect.any(Number),
      });
      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ disclosureId: new ObjectId(customDisclosure._id) });
      expect(dbExchange).toEqual(
        expect.objectContaining({
          ...mongoify({
            protocolMetadata: {
              protocol: ExchangeProtocols.VNF_API,
            },
            events: expect.arrayContaining([
              {
                state: ExchangeStates.CREDENTIAL_MANIFEST_REQUESTED,
                timestamp: expect.any(Date),
              },
            ]),
            tenantId: customTenant._id,
            updatedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should 200, when no exchangeId, no disclosureId, and an unknown credential type', async () => {
      nockRegistrarGetOrganizationVerifiedProfile(
        tenant.did,
        sampleOrganizationVerifiedProfile1
      );
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/EmailV1.0?includeDisplay=false'
        )
        .reply(200, {
          id: 'EmailV1.0',
          name: 'Email',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/Email.json',
            },
          ],
        });
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/WhateverType?includeDisplay=true'
        )
        .reply(404, {});

      const response = await fastify.injectJson({
        method: 'GET',
        url: issuingUrl(tenant.did, '/get-credential-manifest', {
          credential_types: ['WhateverType'],
        }),
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        issuing_request: expect.any(String),
      });
      const { payload } = jwtDecode(response.json.issuing_request);
      expect(payload).toEqual({
        exchange_id: expect.stringMatching(OBJECT_ID_FORMAT),
        output_descriptors: [
          {
            id: 'WhateverType',
            name: 'WhateverType',
            schema: [
              {
                uri: 'WhateverType',
              },
            ],
          },
        ],
        issuer: {
          id: tenant.did,
        },
        presentation_definition: {
          id: `${payload.exchange_id}.${disclosure._id}`,
          name: disclosure.description,
          purpose: 'Identification',
          format: { jwt_vp: { alg: ['secp256k1'] } },
          input_descriptors: [
            {
              id: 'EmailV1.0',
              name: 'Email',
              group: ['A'],
              schema: [
                {
                  uri: 'http://oracle.localhost.test/schemas/Email.json',
                },
              ],
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
          submit_presentation_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/submit-identification'
          )}`,
          check_offers_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/credential-offers'
          )}`,
          finalize_offers_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/finalize-offers'
          )}`,
        },
        iss: tenant.did,
        iat: expect.any(Number),
        exp: expect.any(Number),
        nbf: expect.any(Number),
      });
      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(payload.exchange_id) });
      expect(dbExchange).toEqual({
        _id: new ObjectId(payload.exchange_id),
        type: ExchangeTypes.ISSUING,
        tenantId: new ObjectId(tenant._id),
        disclosureId: new ObjectId(disclosure._id),
        events: [
          { state: ExchangeStates.NEW, timestamp: expect.any(Date) },
          {
            state: ExchangeStates.CREDENTIAL_MANIFEST_REQUESTED,
            timestamp: expect.any(Date),
          },
        ],
        credentialTypes: ['WhateverType'],
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should 200 when no credential types, exchangeId or disclosureId is provided', async () => {
      nockRegistrarGetOrganizationVerifiedProfile(
        tenant.did,
        sampleOrganizationVerifiedProfile1
      );

      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/EmailV1.0?includeDisplay=false'
        )
        .reply(200, {
          id: 'EmailV1.0',
          name: 'Email',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/Email.json',
            },
          ],
        });

      const response = await fastify.injectJson({
        method: 'GET',
        url: issuingUrl(tenant.did, '/get-credential-manifest', {}),
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        issuing_request: expect.any(String),
      });
      const { payload } = jwtDecode(response.json.issuing_request);
      expect(payload).toEqual({
        exchange_id: expect.stringMatching(OBJECT_ID_FORMAT),
        output_descriptors: [],
        issuer: {
          id: tenant.did,
        },
        presentation_definition: {
          id: `${payload.exchange_id}.${disclosure._id}`,
          name: disclosure.description,
          purpose: 'Identification',
          format: { jwt_vp: { alg: ['secp256k1'] } },
          input_descriptors: [
            {
              id: 'EmailV1.0',
              name: 'Email',
              group: ['A'],
              schema: [
                {
                  uri: 'http://oracle.localhost.test/schemas/Email.json',
                },
              ],
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
          submit_presentation_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/submit-identification'
          )}`,
          check_offers_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/credential-offers'
          )}`,
          finalize_offers_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/finalize-offers'
          )}`,
        },
        iss: tenant.did,
        iat: expect.any(Number),
        exp: expect.any(Number),
        nbf: expect.any(Number),
      });
      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(payload.exchange_id) });
      expect(dbExchange).toEqual({
        _id: new ObjectId(payload.exchange_id),
        type: ExchangeTypes.ISSUING,
        tenantId: new ObjectId(tenant._id),
        disclosureId: new ObjectId(disclosure._id),
        events: [
          { state: ExchangeStates.NEW, timestamp: expect.any(Date) },
          {
            state: ExchangeStates.CREDENTIAL_MANIFEST_REQUESTED,
            timestamp: expect.any(Date),
          },
        ],
        credentialTypes: [],
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should 200 when an exchangeId and types are provided', async () => {
      const customDisclosure = await persistDisclosure({
        tenant,
        description: 'Integrated Credential Issuance disclosure',
        types: [{ type: 'EmailV1.0' }],
        vendorEndpoint: VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION,
        purpose: 'Identification',
        duration: '6y',
      });
      const customExchange = await persistOfferExchange({
        tenant,
        disclosure: customDisclosure,
      });

      nockRegistrarGetOrganizationVerifiedProfile(
        tenant.did,
        sampleOrganizationVerifiedProfile1
      );
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/EmailV1.0?includeDisplay=false'
        )
        .reply(200, {
          id: 'EmailV1.0',
          name: 'Email',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/Email.json',
            },
          ],
        });
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/PastEmploymentPosition?includeDisplay=true'
        )
        .reply(200, {
          id: 'PastEmploymentPosition',
          name: 'Past Role',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/PastEmploymentPosition.json',
            },
          ],
          display: {
            title: {
              path: '$.employment',
            },
          },
        });

      const response = await fastify.injectJson({
        method: 'GET',
        url: issuingUrl(tenant.did, '/get-credential-manifest', {
          exchange_id: customExchange._id,
          credential_types: ['PastEmploymentPosition'],
        }),
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        issuing_request: expect.any(String),
      });
      const { payload } = jwtDecode(response.json.issuing_request);
      expect(payload).toEqual({
        exchange_id: customExchange._id,
        output_descriptors: [
          {
            id: 'PastEmploymentPosition',
            name: 'Past Role',
            schema: [
              {
                uri: 'http://oracle.localhost.test/schemas/PastEmploymentPosition.json',
              },
            ],
            display: {
              title: {
                path: '$.employment',
              },
            },
          },
        ],
        issuer: {
          id: tenant.did,
        },
        presentation_definition: {
          id: `${customExchange._id}.${customDisclosure._id}`,
          name: customDisclosure.description,
          purpose: 'Identification',
          format: { jwt_vp: { alg: ['secp256k1'] } },
          input_descriptors: [
            {
              id: 'EmailV1.0',
              name: 'Email',
              group: ['A'],
              schema: [
                {
                  uri: 'http://oracle.localhost.test/schemas/Email.json',
                },
              ],
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
        metadata: {
          client_name: orgDidDoc.service[0].name,
          logo_uri: orgDidDoc.service[0].logo,
          tos_uri: customDisclosure.termsUrl,
          auth_token_uri: `${agentUrl}${tenantUrl(
            { tenantId: tenant.did },
            '/oauth/token'
          )}`,
          max_retention_period: customDisclosure.duration,
          progress_uri: `${agentUrl}${tenantUrl(
            { tenantId: tenant.did },
            '/get-exchange-progress'
          )}`,
          submit_presentation_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/submit-identification'
          )}`,
          check_offers_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/credential-offers'
          )}`,
          finalize_offers_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/finalize-offers'
          )}`,
        },
        iss: tenant.did,
        iat: expect.any(Number),
        exp: expect.any(Number),
        nbf: expect.any(Number),
      });

      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(customExchange._id) });
      expect(dbExchange).toEqual({
        ...mongoify({
          ...customExchange,
          protocolMetadata: {
            protocol: ExchangeProtocols.VNF_API,
          },
          events: [
            ...customExchange.events,
            {
              state: ExchangeStates.CREDENTIAL_MANIFEST_REQUESTED,
              timestamp: expect.any(Date),
            },
          ],
          tenantId: tenant._id,
          updatedAt: expect.any(Date),
        }),
      });
    });

    it('should 200 when exchangeId, types and english locale provided', async () => {
      const customDisclosure = await persistDisclosure({
        tenant,
        description: 'Integrated Credential Issuance disclosure',
        types: [{ type: 'EmailV1.0' }],
        vendorEndpoint: VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION,
        purpose: 'Identification',
        duration: '6y',
      });
      const customExchange = await persistOfferExchange({
        tenant,
        disclosure: customDisclosure,
      });

      nockRegistrarGetOrganizationVerifiedProfile(
        tenant.did,
        sampleOrganizationVerifiedProfile1
      );
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/EmailV1.0?includeDisplay=false'
        )
        .reply(200, {
          id: 'EmailV1.0',
          name: 'Email',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/Email.json',
            },
          ],
        });
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/PastEmploymentPosition?includeDisplay=true&locale=en'
        )
        .reply(200, {
          id: 'PastEmploymentPosition',
          name: 'Past Role',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/PastEmploymentPosition.json',
            },
          ],
          display: {
            title: {
              path: '$.employment',
            },
          },
        });

      const response = await fastify.injectJson({
        method: 'GET',
        url: issuingUrl(tenant.did, '/get-credential-manifest', {
          exchange_id: customExchange._id,
          credential_types: ['PastEmploymentPosition'],
          locale: 'en',
        }),
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        issuing_request: expect.any(String),
      });
      const { payload } = jwtDecode(response.json.issuing_request);
      expect(payload).toEqual({
        exchange_id: customExchange._id,
        output_descriptors: [
          {
            id: 'PastEmploymentPosition',
            name: 'Past Role',
            schema: [
              {
                uri: 'http://oracle.localhost.test/schemas/PastEmploymentPosition.json',
              },
            ],
            display: {
              title: {
                path: '$.employment',
              },
            },
          },
        ],
        issuer: {
          id: tenant.did,
        },
        presentation_definition: {
          id: `${customExchange._id}.${customDisclosure._id}`,
          name: customDisclosure.description,
          purpose: 'Identification',
          format: { jwt_vp: { alg: ['secp256k1'] } },
          input_descriptors: [
            {
              id: 'EmailV1.0',
              name: 'Email',
              group: ['A'],
              schema: [
                {
                  uri: 'http://oracle.localhost.test/schemas/Email.json',
                },
              ],
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
        metadata: {
          client_name: orgDidDoc.service[0].name,
          logo_uri: orgDidDoc.service[0].logo,
          tos_uri: customDisclosure.termsUrl,
          auth_token_uri: `${agentUrl}${tenantUrl(
            { tenantId: tenant.did },
            '/oauth/token'
          )}`,
          max_retention_period: customDisclosure.duration,
          progress_uri: `${agentUrl}${tenantUrl(
            { tenantId: tenant.did },
            '/get-exchange-progress'
          )}`,
          submit_presentation_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/submit-identification'
          )}`,
          check_offers_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/credential-offers'
          )}`,
          finalize_offers_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/finalize-offers'
          )}`,
        },
        iss: tenant.did,
        iat: expect.any(Number),
        exp: expect.any(Number),
        nbf: expect.any(Number),
      });

      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(customExchange._id) });
      expect(dbExchange).toEqual({
        ...mongoify({
          ...customExchange,
          protocolMetadata: {
            protocol: ExchangeProtocols.VNF_API,
          },
          events: [
            ...customExchange.events,
            {
              state: ExchangeStates.CREDENTIAL_MANIFEST_REQUESTED,
              timestamp: expect.any(Date),
            },
          ],
          tenantId: tenant._id,
          updatedAt: expect.any(Date),
        }),
      });
    });

    it('should 200, when credential type & push_delegate provided', async () => {
      nockRegistrarGetOrganizationVerifiedProfile(
        tenant.did,
        sampleOrganizationVerifiedProfile1
      );

      const pushDelegate = {
        pushToken: '123',
        pushUrl: 'https://serivces.com/push_gateway',
      };

      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/EmailV1.0?includeDisplay=false'
        )
        .reply(200, {
          id: 'EmailV1.0',
          name: 'Email',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/Email.json',
            },
          ],
        });
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/PastEmploymentPosition?includeDisplay=true'
        )
        .reply(200, {
          id: 'PastEmploymentPosition',
          name: 'Past Role',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/PastEmploymentPosition.json',
            },
          ],
          display: {
            title: {
              path: '$.employment',
            },
          },
        });

      const response = await fastify.injectJson({
        method: 'GET',
        url: issuingUrl(tenant.did, '/get-credential-manifest', {
          credential_types: 'PastEmploymentPosition',
          'push_delegate.push_token': pushDelegate.pushToken,
          'push_delegate.push_url': pushDelegate.pushUrl,
        }),
      });

      expect(response.statusCode).toEqual(200);
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        issuing_request: expect.any(String),
      });
      const { payload } = jwtDecode(response.json.issuing_request);
      expect(payload).toEqual({
        exchange_id: expect.stringMatching(OBJECT_ID_FORMAT),
        output_descriptors: [
          {
            id: 'PastEmploymentPosition',
            name: 'Past Role',
            schema: [
              {
                uri: 'http://oracle.localhost.test/schemas/PastEmploymentPosition.json',
              },
            ],
            display: {
              title: {
                path: '$.employment',
              },
            },
          },
        ],
        issuer: {
          id: tenant.did,
        },
        presentation_definition: {
          id: `${payload.exchange_id}.${disclosure._id}`,
          name: disclosure.description,
          purpose: 'Identification',
          format: { jwt_vp: { alg: ['secp256k1'] } },
          input_descriptors: [
            {
              id: 'EmailV1.0',
              name: 'Email',
              group: ['A'],
              schema: [
                {
                  uri: 'http://oracle.localhost.test/schemas/Email.json',
                },
              ],
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
        metadata: {
          client_name: orgDidDoc.service[0].name,
          logo_uri: orgDidDoc.service[0].logo,
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
          submit_presentation_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/submit-identification'
          )}`,
          check_offers_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/credential-offers'
          )}`,
          finalize_offers_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/finalize-offers'
          )}`,
        },
        iss: tenant.did,
        iat: expect.any(Number),
        exp: expect.any(Number),
        nbf: expect.any(Number),
      });

      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(payload.exchange_id) });
      expect(dbExchange).toEqual({
        _id: new ObjectId(payload.exchange_id),
        type: ExchangeTypes.ISSUING,
        tenantId: new ObjectId(tenant._id),
        disclosureId: new ObjectId(disclosure._id),
        events: [
          { state: ExchangeStates.NEW, timestamp: expect.any(Date) },
          {
            state: ExchangeStates.CREDENTIAL_MANIFEST_REQUESTED,
            timestamp: expect.any(Date),
          },
        ],
        credentialTypes: ['PastEmploymentPosition'],
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
        pushDelegate,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should 200, when credential type & invalid push_delegate provided (pushUrl not provided)', async () => {
      nockRegistrarGetOrganizationVerifiedProfile(
        tenant.did,
        sampleOrganizationVerifiedProfile1
      );

      const pushDelegate = {
        pushToken: '123',
      };

      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/EmailV1.0?includeDisplay=false'
        )
        .reply(200, {
          id: 'EmailV1.0',
          name: 'Email',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/Email.json',
            },
          ],
        });
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/PastEmploymentPosition?includeDisplay=true'
        )
        .reply(200, {
          id: 'PastEmploymentPosition',
          name: 'Past Role',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/PastEmploymentPosition.json',
            },
          ],
          display: {
            title: {
              path: '$.employment',
            },
          },
        });

      const response = await fastify.injectJson({
        method: 'GET',
        url: issuingUrl(tenant.did, '/get-credential-manifest', {
          credential_types: 'PastEmploymentPosition',
          'push_delegate.push_token': pushDelegate.pushToken,
        }),
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        issuing_request: expect.any(String),
      });
      const { payload } = jwtDecode(response.json.issuing_request);

      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(payload.exchange_id) });
      expect(dbExchange).toEqual({
        _id: new ObjectId(payload.exchange_id),
        type: ExchangeTypes.ISSUING,
        tenantId: new ObjectId(tenant._id),
        disclosureId: new ObjectId(disclosure._id),
        events: [
          { state: ExchangeStates.NEW, timestamp: expect.any(Date) },
          {
            state: ExchangeStates.CREDENTIAL_MANIFEST_REQUESTED,
            timestamp: expect.any(Date),
          },
        ],
        credentialTypes: ['PastEmploymentPosition'],
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should 200, when credential type & invalid push_delegate provided (pushToken not provided)', async () => {
      nockRegistrarGetOrganizationVerifiedProfile(
        tenant.did,
        sampleOrganizationVerifiedProfile1
      );

      const pushDelegate = {
        pushUrl: '123',
      };

      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/EmailV1.0?includeDisplay=false'
        )
        .reply(200, {
          id: 'EmailV1.0',
          name: 'Email',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/Email.json',
            },
          ],
        });
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/PastEmploymentPosition?includeDisplay=true'
        )
        .reply(200, {
          id: 'PastEmploymentPosition',
          name: 'Past Role',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/PastEmploymentPosition.json',
            },
          ],
          display: {
            title: {
              path: '$.employment',
            },
          },
        });

      const response = await fastify.injectJson({
        method: 'GET',
        url: issuingUrl(tenant.did, '/get-credential-manifest', {
          credential_types: 'PastEmploymentPosition',
          'push_delegate.push_url': pushDelegate.pushUrl,
        }),
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        issuing_request: expect.any(String),
      });
      const { payload } = jwtDecode(response.json.issuing_request);

      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(payload.exchange_id) });
      expect(dbExchange).toEqual({
        _id: new ObjectId(payload.exchange_id),
        type: ExchangeTypes.ISSUING,
        tenantId: new ObjectId(tenant._id),
        disclosureId: new ObjectId(disclosure._id),
        events: [
          { state: ExchangeStates.NEW, timestamp: expect.any(Date) },
          {
            state: ExchangeStates.CREDENTIAL_MANIFEST_REQUESTED,
            timestamp: expect.any(Date),
          },
        ],
        credentialTypes: ['PastEmploymentPosition'],
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should 200 & return `json` when json format query param is used', async () => {
      nockRegistrarGetOrganizationVerifiedProfile(
        tenant.did,
        sampleOrganizationVerifiedProfile1
      );
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/EmailV1.0?includeDisplay=false'
        )
        .reply(200, {
          id: 'EmailV1.0',
          name: 'Email',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/Email.json',
            },
          ],
        });
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/PastEmploymentPosition?includeDisplay=true'
        )
        .reply(200, {
          id: 'PastEmploymentPosition',
          name: 'Past Role',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/PastEmploymentPosition.json',
            },
          ],
          display: {
            title: {
              path: '$.employment',
            },
          },
        });
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/CurrentEmploymentPosition?includeDisplay=true'
        )
        .reply(200, {
          id: 'CurrentEmploymentPosition',
          name: 'Current Role',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/CurrentEmploymentPosition.json',
            },
          ],
          display: {
            title: {
              path: '$.current',
            },
          },
        });

      const response = await fastify.injectJson({
        method: 'GET',
        url: issuingUrl(tenant.did, '/get-credential-manifest', {
          credential_types: [
            'PastEmploymentPosition',
            'CurrentEmploymentPosition',
          ],
          format: 'json',
        }),
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        issuing_request: expect.anything(),
      });
      const parsedResponse = response.json.issuing_request;
      expect(parsedResponse).toEqual({
        exchange_id: expect.stringMatching(OBJECT_ID_FORMAT),
        output_descriptors: [
          {
            id: 'PastEmploymentPosition',
            name: 'Past Role',
            schema: [
              {
                uri: 'http://oracle.localhost.test/schemas/PastEmploymentPosition.json',
              },
            ],
            display: {
              title: {
                path: '$.employment',
              },
            },
          },
          {
            id: 'CurrentEmploymentPosition',
            name: 'Current Role',
            schema: [
              {
                uri: 'http://oracle.localhost.test/schemas/CurrentEmploymentPosition.json',
              },
            ],
            display: {
              title: {
                path: '$.current',
              },
            },
          },
        ],
        issuer: {
          id: tenant.did,
        },
        presentation_definition: {
          id: `${parsedResponse.exchange_id}.${disclosure._id}`,
          name: 'Credential Issuance disclosure',
          purpose: 'Identification',
          format: { jwt_vp: { alg: ['secp256k1'] } },
          input_descriptors: [
            {
              id: 'EmailV1.0',
              name: 'Email',
              group: ['A'],
              schema: [
                {
                  uri: 'http://oracle.localhost.test/schemas/Email.json',
                },
              ],
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
          submit_presentation_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/submit-identification'
          )}`,
          check_offers_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/credential-offers'
          )}`,
          finalize_offers_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/finalize-offers'
          )}`,
        },
      });
    });

    it('should 200 & return `jwt` when json format query param in production environment', async () => {
      await fastify.close();
      fastify = await buildFastify({ ...holderConfig, isProd: true });
      nockRegistrarGetOrganizationVerifiedProfile(
        tenant.did,
        sampleOrganizationVerifiedProfile1
      );
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/EmailV1.0?includeDisplay=false'
        )
        .reply(200, {
          id: 'EmailV1.0',
          name: 'Email',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/Email.json',
            },
          ],
        });
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/PastEmploymentPosition?includeDisplay=true'
        )
        .reply(200, {
          id: 'PastEmploymentPosition',
          name: 'Past Role',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/PastEmploymentPosition.json',
            },
          ],
          display: {
            title: {
              path: '$.employment',
            },
          },
        });
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/CurrentEmploymentPosition?includeDisplay=true'
        )
        .reply(200, {
          id: 'CurrentEmploymentPosition',
          name: 'Current Role',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/CurrentEmploymentPosition.json',
            },
          ],
          display: {
            title: {
              path: '$.current',
            },
          },
        });

      const response = await fastify.injectJson({
        method: 'GET',
        url: issuingUrl(tenant.did, '/get-credential-manifest', {
          credential_types: [
            'PastEmploymentPosition',
            'CurrentEmploymentPosition',
          ],
          format: 'json',
        }),
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json.issuing_request).toEqual(
        expect.stringMatching(JWT_FORMAT)
      );
      await fastify.close();
      fastify = await buildFastify();
    });

    it('should 200 and add configuration type to disclosure', async () => {
      const { insertedId } = await mongoDb()
        .collection('disclosures')
        .insertOne({
          description: 'Integrated Credential Issuance disclosure',
          types: [{ type: 'EmailV1.0' }],
          vendorEndpoint: VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION,
          purpose: 'Identification',
          duration: '6y',
          tenantId: new ObjectId(tenant._id),
          vendorDisclosureId: 'HR-PKG-USPS-CLRK',
          termsUrl: 'https://www.lipsum.com/feed/html',
          sendPushOnVerification: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      const customDisclosure = await mongoDb()
        .collection('disclosures')
        .findOne({ _id: insertedId });

      expect(customDisclosure.configurationType).toBeUndefined();

      nockRegistrarGetOrganizationVerifiedProfile(
        tenant.did,
        sampleOrganizationVerifiedProfile1
      );
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/EmailV1.0?includeDisplay=false'
        )
        .reply(200, {
          id: 'EmailV1.0',
          name: 'Email',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/Email.json',
            },
          ],
        });
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/PastEmploymentPosition?includeDisplay=true'
        )
        .reply(200, {
          id: 'PastEmploymentPosition',
          name: 'Past Role',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/PastEmploymentPosition.json',
            },
          ],
          display: {
            title: {
              path: '$.employment',
            },
          },
        });

      const response = await fastify.injectJson({
        method: 'GET',
        url: issuingUrl(tenant.did, '/get-credential-manifest', {
          id: customDisclosure._id.toString(),
          credential_types: ['PastEmploymentPosition'],
        }),
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        issuing_request: expect.any(String),
      });

      const dbDisclosure = await mongoDb()
        .collection('disclosures')
        .findOne({ _id: new ObjectId(customDisclosure._id) });
      expect(dbDisclosure.configurationType).toEqual('issuing');
    });

    it('should 200 and add defaultIssuingDisclosureId to tenant and use defaultIssuingDisclosureId for finding disclosure', async () => {
      const customDisclosure = await persistDisclosure({
        tenant,
        description: 'Integrated Credential Issuance disclosure',
        types: [{ type: 'EmailV1.0' }],
        vendorEndpoint: VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION,
        purpose: 'Identification',
        duration: '6y',
      });

      expect(tenant.defaultIssuingDisclosureId).toBeUndefined();

      nockRegistrarGetOrganizationVerifiedProfile(
        tenant.did,
        sampleOrganizationVerifiedProfile1
      );
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/EmailV1.0?includeDisplay=false'
        )
        .reply(200, {
          id: 'EmailV1.0',
          name: 'Email',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/Email.json',
            },
          ],
        });
      nock('http://oracle.localhost.test')
        .get(
          '/api/v0.6/credential-type-descriptors/PastEmploymentPosition?includeDisplay=true'
        )
        .reply(200, {
          id: 'PastEmploymentPosition',
          name: 'Past Role',
          schema: [
            {
              uri: 'http://oracle.localhost.test/schemas/PastEmploymentPosition.json',
            },
          ],
          display: {
            title: {
              path: '$.employment',
            },
          },
        });

      const response = await fastify.injectJson({
        method: 'GET',
        url: issuingUrl(tenant.did, '/get-credential-manifest', {
          credential_types: ['PastEmploymentPosition'],
        }),
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        issuing_request: expect.any(String),
      });

      const { payload } = jwtDecode(response.json.issuing_request);
      expect(payload).toEqual({
        exchange_id: expect.any(String),
        output_descriptors: [
          {
            id: 'PastEmploymentPosition',
            name: 'Past Role',
            schema: [
              {
                uri: 'http://oracle.localhost.test/schemas/PastEmploymentPosition.json',
              },
            ],
            display: {
              title: {
                path: '$.employment',
              },
            },
          },
        ],
        issuer: {
          id: tenant.did,
        },
        presentation_definition: {
          id: `${payload.exchange_id}.${customDisclosure._id}`,
          name: customDisclosure.description,
          purpose: customDisclosure.purpose,
          format: {
            jwt_vp: { alg: ['secp256k1'] },
          },
          input_descriptors: [
            {
              id: 'EmailV1.0',
              name: 'Email',
              group: ['A'],
              schema: [
                {
                  uri: 'http://oracle.localhost.test/schemas/Email.json',
                },
              ],
            },
          ],
          submission_requirements: [
            {
              from: 'A',
              min: 1,
              rule: 'all',
            },
          ],
        },
        metadata: {
          client_name: orgDidDoc.service[0].name,
          logo_uri: orgDidDoc.service[0].logo,
          tos_uri: customDisclosure.termsUrl,
          auth_token_uri: `${agentUrl}${tenantUrl(
            { tenantId: tenant.did },
            '/oauth/token'
          )}`,
          max_retention_period: customDisclosure.duration,
          progress_uri: `${agentUrl}${tenantUrl(
            { tenantId: tenant.did },
            '/get-exchange-progress'
          )}`,
          submit_presentation_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/submit-identification'
          )}`,
          check_offers_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/credential-offers'
          )}`,
          finalize_offers_uri: `${agentUrl}${issuingUrl(
            tenant.did,
            '/finalize-offers'
          )}`,
        },
        iss: tenant.did,
        exp: expect.any(Number),
        iat: expect.any(Number),
        nbf: expect.any(Number),
      });

      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(payload.exchange_id) });

      expect(dbExchange.disclosureId.toString()).toEqual(
        customDisclosure._id.toString()
      );

      const dbTenant = await mongoDb()
        .collection('tenants')
        .findOne({ _id: new ObjectId(tenant._id) });
      expect(dbTenant.defaultIssuingDisclosureId.toString()).toEqual(
        customDisclosure._id.toString()
      );
    });
  });
});
