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
const { describe, it, after, before, beforeEach, mock } = require('node:test');
const { expect } = require('expect');
const { ALG_TYPE } = require('@verii/metadata-registration');

const mockAddCredentialMetadataEntry = mock.fn();
const mockCreateCredentialMetadataList = mock.fn();
const mockAddRevocationListSigned = mock.fn();

mock.module('@verii/metadata-registration', {
  namedExports: {
    ALG_TYPE,
    initRevocationRegistry: () => ({
      addRevocationListSigned: mockAddRevocationListSigned,
    }),
    initMetadataRegistry: () => ({
      addCredentialMetadataEntry: mockAddCredentialMetadataEntry,
      createCredentialMetadataList: mockCreateCredentialMetadataList,
    }),
  },
});
const { generateKeyPair, encrypt, hexFromJwk } = require('@verii/crypto');
const { getDidUriFromJwk } = require('@verii/did-doc');
const { ObjectId } = require('mongodb');
const { applyOverrides } = require('@verii/common-functions');
const {
  mockHttpClientJsonResponse,
  mockHttpClientModule,
  resetMockHttpClient,
} = require('../helpers/mock-http-client');

mock.module('@verii/http-client', { namedExports: mockHttpClientModule });

const { jwtSign, tamperJwt, jwtDecode } = require('@verii/jwt');
const {
  DID_FORMAT,
  ISO_DATETIME_FORMAT,
  NANO_ID_FORMAT,
} = require('@verii/test-regexes');
const { mongoify } = require('@verii/tests-helpers');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { entries, set } = require('lodash/fp');
const { initKeyFactory } = require('../../src/entities/keys');
const { initTenantFactory } = require('../../src/entities/tenants');
const {
  initIssuerServiceFactory,
} = require('../../src/entities/issuer-services');
const { initDepotFactory } = require('../../src/entities/depots');
const { initCredentialFactory } = require('../../src/entities/credentials');
const createTestFastify = require('../helpers/create-test-fastify');
const { constructTenant } = require('../helpers/construct-tenant');
const {
  ExchangeStates,
  ExchangeProtocols,
  ExchangeTypes,
} = require('../../src/entities/exchanges');

describe('openid4vc credential test suite', () => {
  let fastify;

  let persistTenant;
  let persistIssuerService;
  let persistKey;
  let persistDepot;
  let persistCredential;

  let tenant;
  let issuerKeyPair;
  let holderDid;
  let holderKeyPair;
  let authToken;

  before(async () => {
    fastify = createTestFastify();
    await fastify.ready();
    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistIssuerService } = initIssuerServiceFactory(fastify));
    ({ persistKey } = initKeyFactory(fastify));
    ({ persistDepot } = initDepotFactory(fastify));
    ({ persistCredential } = initCredentialFactory(fastify));

    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('issuerKeys').deleteMany({});
    await mongoDb().collection('depots').deleteMany({});
    await mongoDb().collection('credentials').deleteMany({});
    await mongoDb().collection('exchanges').deleteMany({});

    ({ tenant, issuerKeyPair } = await constructTenant(
      persistTenant,
      persistKey,
    ));
  });

  let issuerService;
  let depot;
  let credential;

  beforeEach(async () => {
    resetMockHttpClient();
    mockAddRevocationListSigned.mock.resetCalls();
    await mongoDb()
      .collection('tenants')
      .updateOne(
        { _id: new ObjectId(tenant._id) },
        { $unset: { credentialSigningAlgorithm: '' } },
      );
    await mongoDb().collection('allocations').deleteMany({});
    await mongoDb().collection('issuerServices').deleteMany({});
    await mongoDb().collection('depots').deleteMany({});
    await mongoDb().collection('credentials').deleteMany({});
    await mongoDb().collection('notifications').deleteMany({});

    holderKeyPair = generateKeyPair({ format: 'jwk' });
    holderDid = getDidUriFromJwk(holderKeyPair.publicKey);
    authToken = await jwtSign({}, issuerKeyPair.privateKey, {
      subject: `https://localhost.test/r/${tenant._id}`,
    });
    issuerService = await persistIssuerService({ tenant });
    depot = await persistDepot({
      tenant,
      service: issuerService,
    });
    credential = await persistCredential({
      depot,
      tenant,
      typeMetadata: {
        credentialType: 'Employment',
        jsonldContext: [],
        layer1: true,
        schemaUrl: 'https://example.com/Employment.schema.json',
      },
    });
  });

  after(async () => {
    await fastify.close();
    mock.reset();
  });

  describe('openid4vc credential test suite', () => {
    describe('openid4vc credential endpoint error cases', () => {
      it('should 401 with invalid_token', async () => {
        const encryptedNonce = encrypt(
          `${Date.now()}`,
          hexFromJwk(issuerKeyPair.privateKey, true),
        );

        const proof = await buildProof(
          holderDid,
          holderKeyPair,
          encryptedNonce,
          {
            typ: 'openid4vci-proof+jwt',
            // aud: 'https://devcih.velocitycareerlabs.io',
          },
        );

        const response = await fastify.injectJson({
          method: 'POST',
          url: `/r/${tenant._id}/openid4vc/credential`,
          headers: {
            authorization: 'Bearer foo',
          },
          payload: {
            credential_identifier: 'foo',
            proofs: { jwt: [proof.jwt] },
          },
        });
        expect(response.statusCode).toEqual(401);
        expect(response.json).toEqual({
          error: 'invalid_token',
          error_description: 'invalid_token',
        });
      });
      it('should 400 with invalid_credential_request', async () => {
        const response = await fastify.injectJson({
          method: 'POST',
          url: `/r/${tenant._id}/openid4vc/credential`,
          headers: {
            authorization: `Bearer ${authToken}`,
          },
          payload: { foo: 'bar' },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual({
          error: 'invalid_credential_request',
          error_description: expect.any(String),
        });
      });
      it('should 400 with invalid_proof if no proofs are sent', async () => {
        const response = await fastify.injectJson({
          method: 'POST',
          url: `/r/${tenant._id}/openid4vc/credential`,
          headers: {
            authorization: `Bearer ${authToken}`,
          },
          payload: {
            credential_identifier: 'foo',
            proofs: { jwt: [] },
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual({
          error: 'invalid_proof',
          error_description: 'Invalid proof',
        });
      });
      it('should 400 with invalid_proof if bad proof is sent', async () => {
        const encryptedNonce = encrypt(
          `${Date.now()}`,
          hexFromJwk(issuerKeyPair.privateKey, true),
        );

        const proof = await buildProof(
          holderDid,
          holderKeyPair,
          encryptedNonce,
          { typ: 'openid4vci-proof+jwt' },
        );

        const response = await fastify.injectJson({
          method: 'POST',
          url: `/r/${tenant._id}/openid4vc/credential`,
          headers: {
            authorization: `Bearer ${authToken}`,
          },
          payload: {
            credential_identifier: 'foo',
            proofs: { jwt: [tamperJwt(proof.jwt, { foo: 'bar' })] },
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual({
          error: 'invalid_proof',
          error_description: 'Error verifying credential request proof jwt.',
        });

        await expect(
          mongoDb()
            .collection('credentials')
            .findOne({ _id: new ObjectId(credential._id) }),
        ).resolves.toEqual(mongoify(credential));
      });
      it('should 400 with unknown_credential_identifier', async () => {
        const encryptedNonce = encrypt(
          `${Date.now()}`,
          hexFromJwk(issuerKeyPair.privateKey, true),
        );

        const proof = await buildProof(
          holderDid,
          holderKeyPair,
          encryptedNonce,
          { typ: 'openid4vci-proof+jwt' },
        );

        const response = await fastify.injectJson({
          method: 'POST',
          url: `/r/${tenant._id}/openid4vc/credential`,
          headers: {
            authorization: `Bearer ${authToken}`,
          },
          payload: {
            credential_identifier: 'foo',
            proofs: { jwt: [proof.jwt] },
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual({
          error: 'unknown_credential_identifier',
          error_description: 'Error identifying credential foo',
        });
      });

      it('should 400 when current credential-type metadata is unavailable', async () => {
        mockHttpClientJsonResponse('get', []);
        const encryptedNonce = encrypt(
          `${Date.now()}`,
          hexFromJwk(issuerKeyPair.privateKey, true),
        );
        const proof = await buildProof(
          holderDid,
          holderKeyPair,
          encryptedNonce,
          { typ: 'openid4vci-proof+jwt' },
        );

        const response = await fastify.injectJson({
          method: 'POST',
          url: `/r/${tenant._id}/openid4vc/credential`,
          headers: {
            authorization: `Bearer ${authToken}`,
          },
          payload: {
            credential_identifier: credential._id,
            proofs: { jwt: [proof.jwt] },
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual({
          error: 'server_error',
          error_description: 'Credential type metadata Employment not found',
        });
        await expect(
          mongoDb()
            .collection('credentials')
            .findOne({ _id: new ObjectId(credential._id) }),
        ).resolves.toEqual(
          expect.objectContaining({
            exchange: expectedDbExchange(
              issuerService,
              [ExchangeStates.NEW, ExchangeStates.UNEXPECTED_ERROR],
              { err: 'Credential type metadata Employment not found' },
            ),
          }),
        );
      });

      it('should 400 if server issue', async () => {
        mockHttpClientJsonResponse('get', [credential.typeMetadata]);
        const encryptedNonce = encrypt(
          `${Date.now()}`,
          hexFromJwk(issuerKeyPair.privateKey, true),
        );

        const proof = await buildProof(
          holderDid,
          holderKeyPair,
          encryptedNonce,
          { typ: 'openid4vci-proof+jwt' },
        );
        mockAddRevocationListSigned.mock.mockImplementationOnce(() =>
          Promise.reject(new Error('error')),
        );

        const response = await fastify.injectJson({
          method: 'POST',
          url: `/r/${tenant._id}/openid4vc/credential`,
          headers: {
            authorization: `Bearer ${authToken}`,
          },
          payload: {
            credential_identifier: credential._id,
            proofs: { jwt: [proof.jwt] },
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual({
          error: 'server_error',
          error_description:
            'revocationRegistry.addWalletToRegistrySigned is not a function',
        });
        await expect(
          mongoDb()
            .collection('credentials')
            .findOne({ _id: new ObjectId(credential._id) }),
        ).resolves.toEqual({
          ...mongoify(credential),
          exchange: expectedDbExchange(
            issuerService,
            [ExchangeStates.NEW, ExchangeStates.UNEXPECTED_ERROR],
            {
              err: 'revocationRegistry.addWalletToRegistrySigned is not a function',
            },
          ),
          updatedAt: expect.any(Date),
        });
      });
    });
    describe('openid4vc credential endpoint success cases', () => {
      it('should 200 with a credential', async () => {
        mockHttpClientJsonResponse('get', [credential.typeMetadata]);
        const encryptedNonce = encrypt(
          `${Date.now()}`,
          hexFromJwk(issuerKeyPair.privateKey, true),
        );

        const proof = await buildProof(
          holderDid,
          holderKeyPair,
          encryptedNonce,
          { typ: 'openid4vci-proof+jwt' },
        );

        const response = await fastify.injectJson({
          method: 'POST',
          url: `/r/${tenant._id}/openid4vc/credential`,
          headers: {
            authorization: `Bearer ${authToken}`,
          },
          payload: {
            credential_identifier: credential._id,
            proofs: { jwt: [proof.jwt] },
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          credentials: [
            {
              credential: expect.any(String),
            },
          ],
          notification_id: expect.any(String),
        });
        const [{ credential: compactCredential }] = response.json.credentials;
        const { header, payload } = jwtDecode(compactCredential);
        expect(header).toEqual({
          alg: 'ES256K',
          cty: 'vc',
          kid: `${payload.id}#key-1`,
          typ: 'vc+jwt',
        });
        expect(payload).toEqual({
          '@context': [
            'https://www.w3.org/ns/credentials/v2',
            'https://lib.velocitynetwork.foundation/contexts/credential-extensions-2022.jsonld.json',
          ],
          contentHash: {
            type: 'VelocityContentHash2020',
            value: credential.contentHash,
          },
          credentialSchema: {
            id: credential.typeMetadata.schemaUrl,
            type: 'JsonSchemaValidator2018',
          },
          credentialStatus: {
            id: expect.any(String),
            type: 'VelocityRevocationListJan2021',
          },
          credentialSubject: {
            id: holderDid,
            ...credential.content.credentialSubject,
          },
          id: expect.stringMatching(DID_FORMAT),
          issuer: { id: tenant.did },
          refreshService: {
            id: `${tenant.did}${issuerService.velocityNetworkServiceId}`,
            type: 'VelocityNetworkRefreshService2024',
          },
          type: ['VerifiableCredential', 'Employment'],
          validFrom: expect.stringMatching(ISO_DATETIME_FORMAT),
          vnfProtocolVersion: 2,
        });
        expect(payload).not.toHaveProperty('vc');

        await expect(
          mongoDb()
            .collection('credentials')
            .findOne({ _id: new ObjectId(credential._id) }),
        ).resolves.toEqual({
          ...mongoify(credential),
          credentialSubjectId: holderDid,
          did: payload.id,
          credentialStatus: payload.credentialStatus,
          dataModelVersion: '2.0',
          digestSRI: expect.any(String),
          envelopeFormat: 'vc+jwt',
          jwtVc: compactCredential,
          signingAlgorithm: 'ES256K',
          exchange: expectedDbExchange(
            issuerService,
            [ExchangeStates.NEW, ExchangeStates.CREDENTIALS_SIGNED],
            {
              credentialMetadata: {
                contentHash: expect.any(String),
                credentialType: 'Employment',
                credentialTypeEncoded: '0xfe3f',
                index: expect.any(Number),
                isNewList: true,
                listId: expect.any(Number),
                algType: 'aes-256-gcm',
                publicKey: {
                  crv: 'secp256k1',
                  kty: 'EC',
                  x: expect.any(String),
                  y: expect.any(String),
                },
              },
            },
          ),
          updatedAt: expect.any(Date),
        });
      });

      it('should sign with ES256 when the tenant policy overrides the type default', async () => {
        mockHttpClientJsonResponse('get', [credential.typeMetadata]);
        await mongoDb()
          .collection('tenants')
          .updateOne(
            { _id: new ObjectId(tenant._id) },
            { $set: { credentialSigningAlgorithm: 'ES256' } },
          );
        const encryptedNonce = encrypt(
          `${Date.now()}`,
          hexFromJwk(issuerKeyPair.privateKey, true),
        );
        const proof = await buildProof(
          holderDid,
          holderKeyPair,
          encryptedNonce,
          { typ: 'openid4vci-proof+jwt' },
        );

        const response = await fastify.injectJson({
          method: 'POST',
          url: `/r/${tenant._id}/openid4vc/credential`,
          headers: {
            authorization: `Bearer ${authToken}`,
          },
          payload: {
            credential_identifier: credential._id,
            proofs: { jwt: [proof.jwt] },
          },
        });

        expect(response.statusCode).toEqual(200);
        const { header } = jwtDecode(response.json.credentials[0].credential);
        expect(header.alg).toEqual('ES256');
        await expect(
          mongoDb()
            .collection('credentials')
            .findOne({ _id: new ObjectId(credential._id) }),
        ).resolves.toEqual(
          expect.objectContaining({
            signingAlgorithm: 'ES256',
            exchange: expect.objectContaining({
              credentialMetadata: expect.objectContaining({
                publicKey: expect.objectContaining({
                  crv: 'P-256',
                  kty: 'EC',
                }),
              }),
            }),
          }),
        );
      });

      it('should issue with the current credential-type algorithm advertised by metadata', async () => {
        const persistedTypeMetadata = {
          ...credential.typeMetadata,
          defaultSignatureAlgorithm: 'RS256',
        };
        const currentTypeMetadata = {
          ...persistedTypeMetadata,
          defaultSignatureAlgorithm: 'ES256',
          issuerCategory: 'RegularIssuer',
        };
        await mongoDb()
          .collection('credentials')
          .updateOne(
            { _id: new ObjectId(credential._id) },
            { $set: { typeMetadata: persistedTypeMetadata } },
          );
        mockHttpClientJsonResponse('get', [currentTypeMetadata]);
        mockHttpClientJsonResponse('get', {
          credentialSubject: {
            permittedVelocityServiceCategory: ['Issuer'],
          },
        });
        mockHttpClientJsonResponse('get', [currentTypeMetadata]);

        const metadataResponse = await fastify.injectJson({
          method: 'GET',
          url: `.well-known/openid-credential-issuer/r/${tenant._id}`,
        });
        expect(metadataResponse.statusCode).toEqual(200);
        expect(
          metadataResponse.json.credential_configurations_supported[
            'foundation.velocitynetwork.Employment'
          ].credential_signing_alg_values_supported,
        ).toEqual(['ES256']);

        const encryptedNonce = encrypt(
          `${Date.now()}`,
          hexFromJwk(issuerKeyPair.privateKey, true),
        );
        const proof = await buildProof(
          holderDid,
          holderKeyPair,
          encryptedNonce,
          { typ: 'openid4vci-proof+jwt' },
        );
        const credentialResponse = await fastify.injectJson({
          method: 'POST',
          url: `/r/${tenant._id}/openid4vc/credential`,
          headers: {
            authorization: `Bearer ${authToken}`,
          },
          payload: {
            credential_identifier: credential._id,
            proofs: { jwt: [proof.jwt] },
          },
        });

        expect(credentialResponse.statusCode).toEqual(200);
        expect(
          jwtDecode(credentialResponse.json.credentials[0].credential).header
            .alg,
        ).toEqual('ES256');
        await expect(
          mongoDb()
            .collection('credentials')
            .findOne({ _id: new ObjectId(credential._id) }),
        ).resolves.toEqual(
          expect.objectContaining({ signingAlgorithm: 'ES256' }),
        );
      });
    });
  });
});

const buildProof = async (
  didJwk,
  keyPair,
  challenge,
  { useKid = true, typ = 'openid4vci-proof+jwt', ...payloadOverrides } = {},
) => {
  const options = {
    alg: keyPair.publicKey.crv === 'P-256' ? 'ES256' : 'ES256K',
    typ,
  };
  if (useKid) {
    options.kid = `${didJwk}#0`;
  } else {
    options.jwk = keyPair.publicKey;
  }
  const jwt = await jwtSign(
    applyOverrides(
      {
        aud: 'https://localhost.test',
        nonce: challenge,
        iss: didJwk,
      },
      payloadOverrides,
    ),
    keyPair.privateKey,
    options,
  );
  return {
    proof_type: 'jwt',
    jwt,
  };
};

const expectedDbExchange = (issuerService, events, overrides) => {
  const exchangeEvents = events ?? [ExchangeStates.NEW];
  let expectation = {
    id: expect.stringMatching(NANO_ID_FORMAT),
    protocolMetadata: { protocol: ExchangeProtocols.OPENID4VCI },
    events: exchangeEvents.map((state) => ({
      state,
      timestamp: expect.any(Date),
    })),
    serviceId: new ObjectId(issuerService._id),
    type: ExchangeTypes.ISSUER,
  };

  for (const [issuerKey, value] of entries(overrides)) {
    expectation = set(issuerKey, value, expectation);
  }

  return expectation;
};
