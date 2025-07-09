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
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { ServiceTypes } = require('@verii/organizations-registry');
const { errorResponseMatcher } = require('@verii/tests-helpers');
const initOrganizationFactory = require('../src/entities/organizations/factories/organizations-factory');
const buildFastify = require('./helpers/build-fastify');

const baseUrl = '/api/v0.6/resolve-did';

describe('Resolve did test suite', () => {
  let fastify;
  let persistOrganization;

  beforeAll(async () => {
    fastify = buildFastify();
    await fastify.ready();

    ({ persistOrganization } = initOrganizationFactory(fastify));
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    nock.cleanAll();
    await mongoDb().collection('organizations').deleteMany({});
  });

  afterAll(async () => {
    await fastify.close();
    nock.cleanAll();
    nock.restore();
  });

  describe('did:ion resolution', () => {
    it('Should return 404 when DID document not found', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: `${baseUrl}/did:test:123`,
      });

      expect(response.statusCode).toEqual(404);
    });

    it('Should resolve did for "did:ion" did', async () => {
      const organization = await persistOrganization();
      const { didDoc } = organization;
      const did = didDoc.id;

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${baseUrl}/${did}`,
      });

      expect(response.json).toEqual(didDoc);
    });

    it('Should resolve did for "did:ion" did with WebWalletProvider service type', async () => {
      const organization = await persistOrganization({
        service: [
          {
            id: '#wallet-provider-1',
            type: ServiceTypes.WebWalletProviderType,
            serviceEndpoint: 'https://agent.samplevendor.com',
            logoUrl: 'http://example.com/logo',
            name: 'fooWallet',
          },
        ],
      });
      const { didDoc } = organization;
      const did = didDoc.id;

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${baseUrl}/${did}`,
      });

      expect(response.json).toEqual(didDoc);
    });
  });

  describe('alsoKnownAs based resolution', () => {
    it("Should resolve did present in did doc's alsoKnownAs list", async () => {
      const organization = await persistOrganization({
        alsoKnownAs: 'did:foo:bar',
      });

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${baseUrl}/did:foo:bar`,
      });

      expect(response.json).toEqual({
        ...organization.didDoc,
        id: 'did:foo:bar',
        alsoKnownAs: [organization.didDoc.id],
      });
    });
  });

  describe('did:web resolution', () => {
    const expectedDidWebDoc = {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/jws-2020/v1',
      ],
      id: 'did:web:nock.test',
      verificationMethod: [
        {
          id: 'did:web:nock.test#key-1',
          type: 'EcdsaSecp256k1VerificationKey2019',
          controller: 'did:web:nock.test',
          publicKeyMultibase: '456',
        },
        {
          id: 'did:web:nock.test#key-2',
          type: 'EcdsaSecp256k1VerificationKey2019',
          controller: 'did:web:nock.test',
          publicKeyBase58: '123',
        },
      ],
      authentication: ['did:web:nock.test#key-1'],
      assertionMethod: ['did:web:nock.test#key-1'],
      publicKey: [
        {
          id: 'did:web:nock.test#key-3',
          type: 'JsonWebKey2020',
          controller: 'did:web:nock.test',
          publicKeyJwk: {
            crv: 'secp256k1',
            kty: 'EC',
            x: 'x',
            y: 'y',
          },
        },
      ],
      service: [
        {
          id: '#service-1',
          type: 'VlcCareerIssuer_v1',
          serviceEndpoint: 'https://nock.test/credentials',
        },
      ],
    };

    it('Should resolve did for "DID:WEB"', async () => {
      const nockData = nock('https://nock.test')
        .get('/.well-known/did.json')
        .reply(200, expectedDidWebDoc);
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${baseUrl}/did:web:nock.test`,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual(expectedDidWebDoc);
      expect(nockData.isDone()).toBe(true);
    });

    it('Should resolve did:web with path', async () => {
      const nockData = nock('https://localhost:8081')
        .get('/d/www.acmecorp.com/did.json')
        .reply(200, {
          id: 'did:web:localhost%3A8081:d:www.acmecorp.com',
        });
      await persistOrganization({
        didDocId: 'did:web:localhost%3A8081:d:www.acmecorp.com',
      });

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${baseUrl}/${encodeURIComponent(
          'did:web:localhost%3A8081:d:www.acmecorp.com'
        )}`,
      });

      expect(response.statusCode).toEqual(200);

      expect(nockData.isDone()).toBe(true);
      expect(response.json).toEqual({
        id: 'did:web:localhost%3A8081:d:www.acmecorp.com',
      });
    });

    it('Should resolve did:web with port and path', async () => {
      const nockData = nock('https://nock.test:8000')
        .get('/test/did.json')
        .reply(200, {
          id: 'did:web:nock.test:test',
        });
      await persistOrganization({
        didDocId: 'did:web:nock.test:test',
      });

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${baseUrl}/${encodeURIComponent(
          'did:web:nock.test%3A8000:test'
        )}`,
      });

      expect(response.statusCode).toEqual(200);

      expect(nockData.isDone()).toBe(true);
      expect(response.json).toEqual({
        id: 'did:web:nock.test:test',
      });
    });

    it('Should resolve did with aliases for encoded "did:web"', async () => {
      const nockData = nock('https://nock.test:3000')
        .get('/.well-known/did.json')
        .reply(200, {
          id: 'did:web:nock.test%3A3000',
        });
      await persistOrganization({
        didDocId: 'did:web:nock.test%3A3000',
        services: [
          {
            id: '#service-1',
            type: 'VlcCareerIssuer_v1',
            serviceEndpoint: 'https://nock.test/credentials',
          },
        ],
      });

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${baseUrl}/${encodeURIComponent('did:web:nock.test%3A3000')}`,
      });

      expect(response.statusCode).toEqual(200);

      expect(nockData.isDone()).toBe(true);
      expect(response.json).toEqual({
        id: 'did:web:nock.test%3A3000',
      });
    });

    it('Should error with 404 when DID document receives not found error', async () => {
      const nockData = nock('https://nock.test')
        .get('/.well-known/did.json')
        .reply(404);
      const organization = await persistOrganization({
        didDocId: 'did:web:nock.test',
        service: [
          {
            id: '#service-1',
            type: 'VlcCareerIssuer_v1',
            serviceEndpoint: 'https://nock.test/credentials',
          },
        ],
      });
      const { didDoc } = organization;
      const did = didDoc.id;

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${baseUrl}/${did}`,
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'did_resolution_failed',
          message: 'Could not resolve did:web:nock.test',
          statusCode: 404,
        })
      );
      expect(nockData.isDone()).toBe(true);
    });

    it('Should error with 404 when DID document resolve receives 500 error', async () => {
      const nockData = nock('https://nock.test')
        .get('/.well-known/did.json')
        .reply(500);
      const didDocId = 'did:web:nock.test';
      await persistOrganization({
        didDocId,
        service: [
          {
            id: '#service-1',
            type: 'VlcCareerIssuer_v1',
            serviceEndpoint: 'https://nock.test/credentials',
          },
        ],
      });

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${baseUrl}/${didDocId}`,
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'did_resolution_failed',
          message: 'Could not resolve did:web:nock.test',
          statusCode: 404,
        })
      );
      expect(nockData.isDone()).toBe(true);
    });
  });

  describe('other did resolution tests', () => {
    it('Should resolve other did methods locally', async () => {
      const did = 'did:unknown:123';
      const organization = await persistOrganization({ did });
      const { didDoc } = organization;

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${baseUrl}/${did}`,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual(didDoc);
    });
    it('[Deprecated] Should resolve did for "did:velocity" did', async () => {
      const did = 'did:velocity:123';
      const organization = await persistOrganization({ did });

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${baseUrl}/${did}`,
      });

      expect(response.json).toEqual(organization.didDoc);
    });
  });
});
