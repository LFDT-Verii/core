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
const { extractVerificationKey } = require('@verii/did-doc');
const {
  publicKeyHexToPem,
  KeyPurposes,
  generateKeyPair,
} = require('@verii/crypto');
const { jwkFromSecp256k1Key, hexFromJwk } = require('@verii/jwt');
const { errorResponseMatcher } = require('@verii/tests-helpers');
const { default: bs58 } = require('bs58');
const initOrganizationFactory = require('../src/entities/organizations/factories/organizations-factory');
const buildFastify = require('./helpers/build-fastify');

const DEFAULT_KEYS = [
  {
    id: '#vc-signing-key-1',
    purposes: [KeyPurposes.ISSUING_METADATA],
    publicKey: generateKeyPair({ format: 'jwk' }).publicKey,
  },
  {
    id: '#eth-account-key-1',
    purposes: [KeyPurposes.DLT_TRANSACTIONS],
    publicKey: generateKeyPair({ format: 'jwk' }).publicKey,
  },
];

describe('Public Key Resolution', () => {
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
    await mongoDb().collection('organizationKeys').deleteMany({});
  });

  afterAll(async () => {
    await fastify.close();
    nock.cleanAll();
    nock.restore();
  });

  it('Should return 404 when DID document not found', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/api/v0.6/resolve-kid/did:test:123#key-1',
    });

    expect(response.statusCode).toEqual(404);
  });

  it('Should return 404 when public key not found in document', async () => {
    const organization = await persistOrganization({
      keys: DEFAULT_KEYS,
    });
    const did = organization.didDoc.id;
    const response = await fastify.inject({
      method: 'GET',
      url: `/api/v0.6/resolve-kid/${encodeURIComponent(`${did}#key-1`)}`,
    });

    expect(response.statusCode).toEqual(404);
  });

  it('[Deprecated] Should resolve kid public key for "did:velocity" did with jwk publicKey', async () => {
    const organization = await persistOrganization({
      didDocId: 'did:velocity:123',
      keys: DEFAULT_KEYS,
    });
    const { didDoc } = organization;
    const did = didDoc.id;
    const kidFragment = '#vc-signing-key-1';
    const kid = `${did}${kidFragment}`;
    const publicKeyHex0 = extractVerificationKey(didDoc, kid);

    const response = await fastify.inject({
      method: 'GET',
      url: `/api/v0.6/resolve-kid/${encodeURIComponent(kid)}`,
    });

    expect(response.body).toEqual(publicKeyHexToPem(publicKeyHex0));
  });

  it('[Deprecated] Should resolve kid public key for "did:velocity" did with base58 publicKey as jwk', async () => {
    const organization = await persistOrganization({
      didDoc: {
        id: 'did:velocity:123',
        publicKey: [
          {
            id: 'did:velocity:123#key-1',
            type: 'EcdsaSecp256k1Signature2019',
            controller: 'did:velocity:123',
            publicKeyBase58:
              'NTcuWAkJAvPJ374UixHoqjV5vMJaozep9G4JQigom6gWkbRGwMf1mKpJSuJvQ6P5dvAQ3W3TtKrTc75ZPWDFdpQ1',
          },
        ],
      },
    });
    const { didDoc } = organization;
    const did = didDoc.id;
    const kidFragment = '#key-1';
    const kid = `${did}${kidFragment}`;
    const publicKeyHex0 = extractVerificationKey(didDoc, kid);

    const response = await fastify.inject({
      method: 'GET',
      url: `/api/v0.6/resolve-kid/${encodeURIComponent(kid)}?format=jwk`,
    });

    expect(response.body).toEqual(
      JSON.stringify(jwkFromSecp256k1Key(publicKeyHex0, false))
    );
  });

  it('Should return public key in default (PEM) format when query param not passed', async () => {
    const organization = await persistOrganization({
      keys: DEFAULT_KEYS,
    });
    const { didDoc } = organization;
    const did = didDoc.id;
    const kidFragment = '#vc-signing-key-1';
    const kid = `${did}${kidFragment}`;
    const publicKeyHex0 = extractVerificationKey(didDoc, kid);

    const response = await fastify.inject({
      method: 'GET',
      url: `/api/v0.6/resolve-kid/${encodeURIComponent(kid)}`,
    });

    expect(response.body).toEqual(publicKeyHexToPem(publicKeyHex0));
  });

  it("Should return public key in PEM format when query param set to 'pem'", async () => {
    const organization = await persistOrganization({
      keys: DEFAULT_KEYS,
    });
    const { didDoc } = organization;
    const did = didDoc.id;
    const kidFragment = '#vc-signing-key-1';
    const kid = `${did}${kidFragment}`;
    const publicKeyHex0 = extractVerificationKey(didDoc, kid);

    const response = await fastify.inject({
      method: 'GET',
      url: `/api/v0.6/resolve-kid/${encodeURIComponent(kid)}?format=pem`,
    });

    expect(response.body).toEqual(publicKeyHexToPem(publicKeyHex0));
  });

  it("Should return public key in HEX format when query param set to 'hex'", async () => {
    const organization = await persistOrganization({
      keys: DEFAULT_KEYS,
    });
    const { didDoc } = organization;
    const did = didDoc.id;
    const kidFragment = '#vc-signing-key-1';
    const kid = `${did}${kidFragment}`;
    const publicKeyHex0 = extractVerificationKey(didDoc, kid);

    const response = await fastify.inject({
      method: 'GET',
      url: `/api/v0.6/resolve-kid/${encodeURIComponent(kid)}?format=hex`,
    });

    expect(response.body).toEqual(publicKeyHex0);
  });

  it("Should return public key in BASE58 format when query param set to 'base58'", async () => {
    const organization = await persistOrganization({
      keys: DEFAULT_KEYS,
    });
    const { didDoc } = organization;
    const did = didDoc.id;
    const kidFragment = '#vc-signing-key-1';
    const kid = `${did}${kidFragment}`;
    const publicKeyHex0 = extractVerificationKey(didDoc, kid);

    const response = await fastify.inject({
      method: 'GET',
      url: `/api/v0.6/resolve-kid/${encodeURIComponent(kid)}?format=base58`,
    });

    expect(response.body).toEqual(
      bs58.encode(Buffer.from(publicKeyHex0, 'hex'))
    );
  });

  it("Should return public key in JWK format when query param set to 'jwk'", async () => {
    const organization = await persistOrganization({
      keys: DEFAULT_KEYS,
    });
    const { didDoc } = organization;
    const did = didDoc.id;
    const kidFragment = '#vc-signing-key-1';
    const kid = `${did}${kidFragment}`;
    const publicKeyHex0 = extractVerificationKey(didDoc, kid);

    const response = await fastify.inject({
      method: 'GET',
      url: `/api/v0.6/resolve-kid/${encodeURIComponent(kid)}?format=jwk`,
    });

    expect(JSON.parse(response.body)).toEqual({
      ...jwkFromSecp256k1Key(publicKeyHex0, false),
    });
  });

  describe('DID:WEB test suite', () => {
    const keyPair = generateKeyPair({ format: 'jwk' });
    const expectedDidWebDoc = {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/jws-2020/v1',
      ],
      id: 'did:web:example.com',
      verificationMethod: [
        {
          id: 'did:web:example.com#key-0',
          type: 'JsonWebKey2020',
          controller: 'did:web:example.com',
          publicKeyJwk: keyPair.publicKey,
        },
      ],
      authentication: ['did:web:example.com#key-0'],
      assertionMethod: ['did:web:example.com#key-0'],
      publicKey: [
        {
          id: 'did:web:example.com#key-0',
          type: 'JsonWebKey2020',
          controller: 'did:web:example.com',
          publicKeyJwk: keyPair.publicKey,
        },
      ],
      service: [{}],
    };

    it('Should return 404 when DID document not found', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v0.6/resolve-kid/did:web:example.com#key-0',
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json()).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'did_resolution_failed',
          message: 'Could not resolve did:web:example.com',
          statusCode: 404,
        })
      );
    });

    it('Should return 404 when public key not found in document', async () => {
      const nockData = nock('https://example.com')
        .get('/.well-known/did.json')
        .reply(200, expectedDidWebDoc);

      await persistOrganization({
        didDocId: expectedDidWebDoc.id,
      });
      const kid = 'did:web:example.com#key-1';

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/v0.6/resolve-kid/${encodeURIComponent(kid)}`,
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json()).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'missing_error_code',
          message: 'Public key was not found in document did:web:example.com',
          statusCode: 404,
        })
      );
      expect(nockData.isDone()).toBeTruthy();
    });

    it('Should return public key for "DID:WEB" did', async () => {
      const nockData = nock('https://example.com')
        .get('/.well-known/did.json')
        .reply(200, expectedDidWebDoc);

      await persistOrganization({
        didDocId: expectedDidWebDoc.id,
      });
      const kid = expectedDidWebDoc.verificationMethod[0].id;

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/v0.6/resolve-kid/${encodeURIComponent(kid)}`,
      });
      expect(response.statusCode).toEqual(200);
      expect(nockData.isDone()).toBeTruthy();

      expect(response.body).toBe(
        publicKeyHexToPem(hexFromJwk(keyPair.publicKey, false))
      );
    });

    it("Should return public key in PEM format when query param set to 'pem'", async () => {
      const nockData = nock('https://example.com')
        .get('/.well-known/did.json')
        .reply(200, expectedDidWebDoc);

      await persistOrganization({
        didDocId: expectedDidWebDoc.id,
      });
      const kid = expectedDidWebDoc.verificationMethod[0].id;

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/v0.6/resolve-kid/${encodeURIComponent(kid)}?format=pem`,
      });

      expect(response.statusCode).toEqual(200);
      expect(nockData.isDone()).toBeTruthy();

      expect(response.body).toBe(
        publicKeyHexToPem(hexFromJwk(keyPair.publicKey, false))
      );
    });

    it("Should return public key in HEX format when query param set to 'hex'", async () => {
      const nockData = nock('https://example.com')
        .get('/.well-known/did.json')
        .reply(200, expectedDidWebDoc);

      await persistOrganization({
        didDocId: expectedDidWebDoc.id,
      });
      const kid = expectedDidWebDoc.verificationMethod[0].id;

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/v0.6/resolve-kid/${encodeURIComponent(kid)}?format=hex`,
      });

      expect(response.statusCode).toEqual(200);
      expect(nockData.isDone()).toBeTruthy();
      expect(response.body).toEqual(hexFromJwk(keyPair.publicKey, false));
    });

    it("Should return public key in BASE58 format when query param set to 'base58'", async () => {
      const nockData = nock('https://example.com')
        .get('/.well-known/did.json')
        .reply(200, expectedDidWebDoc);

      await persistOrganization({
        didDocId: expectedDidWebDoc.id,
      });
      const kid = expectedDidWebDoc.verificationMethod[0].id;

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/v0.6/resolve-kid/${encodeURIComponent(kid)}?format=base58`,
      });
      expect(response.statusCode).toEqual(200);
      expect(nockData.isDone()).toBeTruthy();

      expect(response.body).toEqual(
        bs58.encode(Buffer.from(hexFromJwk(keyPair.publicKey, false), 'hex'))
      );
    });

    it("Should return public key in JWK format when query param set to 'jwk'", async () => {
      const nockData = nock('https://example.com')
        .get('/.well-known/did.json')
        .reply(200, expectedDidWebDoc);

      await persistOrganization({
        didDocId: expectedDidWebDoc.id,
      });
      const kid = expectedDidWebDoc.verificationMethod[0].id;

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/v0.6/resolve-kid/${encodeURIComponent(kid)}?format=jwk`,
      });
      expect(response.statusCode).toEqual(200);
      expect(nockData.isDone()).toBeTruthy();

      expect(response.json()).toEqual({
        ...keyPair.publicKey,
        use: 'sig',
      });
    });
  });

  describe('alsoKnownAs resolve-kid test suite ', () => {
    it("Should return public key of did present in did-doc's alsoKnownAs list", async () => {
      const organization = await persistOrganization({
        keys: DEFAULT_KEYS,
        alsoKnownAs: ['did:foo:bar'],
      });
      const { didDoc } = organization;
      const kidFragment = '#vc-signing-key-1';
      const kid = `did:foo:bar${kidFragment}`;
      const publicKeyHex0 = extractVerificationKey(didDoc, kid);

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/v0.6/resolve-kid/${encodeURIComponent(kid)}`,
      });

      expect(response.body).toEqual(publicKeyHexToPem(publicKeyHex0));
    });
  });
});
