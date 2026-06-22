/*
 * Copyright 2026 Velocity Team
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
const {
  after,
  afterEach,
  before,
  beforeEach,
  describe,
  it,
  mock,
} = require('node:test');
const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { applyOverrides, mapWithIndex } = require('@verii/common-functions');
const { generateKeyPair } = require('@verii/crypto');
const { getDidUriFromJwk } = require('@verii/did-doc');
const {
  generateCredentialJwt,
  generatePresentationJwt,
} = require('@verii/jwt');
const { nanoid } = require('nanoid');
const nock = require('nock').default;
const createTestFastify = require('../helpers/create-test-fastify');
const { constructTenant } = require('../helpers/construct-tenant');
const {
  buildOpenBadgeCredential,
} = require('../helpers/build-open-badge-credential');
const { initDepotFactory } = require('../../src/entities/depots');
const {
  ExchangeProtocols,
  ExchangeStates,
  ExchangeTypes,
  initExchangeFactory,
} = require('../../src/entities/exchanges');
const { initKeyFactory } = require('../../src/entities/keys');
const {
  initRelyingPartyServiceFactory,
} = require('../../src/entities/relying-party-services');
const { initTenantFactory } = require('../../src/entities/tenants');
const {
  PresentationFormat,
} = require('../../src/entities/presentations/domain/presentation-format');
const {
  postAuthorizationResponse,
} = require('../../src/entities/openid4vp/orchestrators');

describe('openid4vp > direct-post', () => {
  let fastify;
  let persistTenant;
  let persistKey;
  let persistRelyingPartyService;
  let persistDepot;
  let persistExchange;
  let tenant;
  let relyingPartyService;
  let depot;
  let exchange;
  let holder;
  let descriptorServiceScope;

  before(async () => {
    fastify = createTestFastify();
    await fastify.ready();
    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistKey } = initKeyFactory(fastify));
    ({ persistRelyingPartyService } = initRelyingPartyServiceFactory(fastify));
    ({ persistDepot } = initDepotFactory(fastify));
    ({ persistExchange } = initExchangeFactory(
      fastify,
      ExchangeTypes.RELYING_PARTY,
    ));

    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});
    ({ tenant } = await constructTenant(persistTenant, persistKey));
  });

  beforeEach(async () => {
    await mongoDb().collection('relyingPartyServices').deleteMany({});
    await mongoDb().collection('exchanges').deleteMany({});
    await mongoDb().collection('depots').deleteMany({});
    await mongoDb().collection('presentations').deleteMany({});

    relyingPartyService = await persistRelyingPartyService({
      tenant,
      presentationDefinition: undefined,
      disclosureRequest: {
        types: [{ type: 'OpenBadgeCredential' }],
        purpose: 'Career verification',
      },
    });
    depot = await persistDepot({ tenant, service: relyingPartyService });
    const exchangeId = new ObjectId();
    exchange = await persistExchange({
      _id: exchangeId,
      tenant,
      service: relyingPartyService,
      depotId: new ObjectId(depot._id),
      protocolMetadata: {
        protocol: ExchangeProtocols.OPENID4VP,
        nonce: 'openid4vp-nonce',
        walletNonce: 'wallet-nonce',
        presentationDefinition: expectedPresentationDefinition(
          relyingPartyService,
          exchangeId,
        ),
        presentationRequestExpiresAt: new Date(Date.now() + 600000),
      },
      events: [
        { state: ExchangeStates.NEW, timestamp: new Date() },
        {
          state: ExchangeStates.PRESENTATION_REQUEST_REQUESTED,
          timestamp: new Date(),
        },
      ],
    });
    holder = generateHolder();

    descriptorServiceScope = nock('http://oracle.localhost.test')
      .get('/api/v0.6/credential-type-descriptors/OpenBadgeCredential')
      .query({ includeDisplay: 'false' })
      .reply(500, { error: 'descriptor service should not be called' });
    nock('http://oracle.localhost.test')
      .get('/api/v0.6/credential-types', () => true)
      .reply(
        200,
        [
          {
            credentialType: 'Passport',
            issuerCategory: 'ContactIssuer',
          },
        ],
        { 'cache-control': 'max-age=3600' },
      );
  });

  afterEach(() => {
    expect(descriptorServiceScope.isDone()).toEqual(false);
    nock.cleanAll();
  });

  after(async () => {
    await fastify.close();
    nock.restore();
    mock.reset();
  });

  it('should accept a direct-post authorization response and store the presentation', async () => {
    const vp = await buildVp(tenant, holder, exchange);
    const jwtVp = await generatePresentationJwt(
      vp,
      holder.keyPair.privateKey,
      `${holder.did}#key`,
    );

    const response = await injectDirectPost({
      fastify,
      tenant,
      payload: directPostPayload(exchange, jwtVp, vp),
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json()).toEqual({});

    await expect(
      mongoDb()
        .collection('presentations')
        .find({ depotId: new ObjectId(depot._id) })
        .toArray(),
    ).resolves.toEqual([expectedDbPresentation(tenant, exchange, jwtVp)]);

    await expect(
      mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(exchange._id) }),
    ).resolves.toEqual(
      expectedDbExchange(tenant, relyingPartyService, depot, exchange),
    );
  });

  it('should accept a direct-post authorization error response and record exchange metadata', async () => {
    const response = await injectDirectPost({
      fastify,
      tenant,
      payload: {
        state: exchange._id.toString(),
        error: 'access_denied',
        error_description: 'Wallet holder declined presentation sharing',
      },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json()).toEqual({});

    await expect(
      mongoDb()
        .collection('presentations')
        .countDocuments({ exchangeId: new ObjectId(exchange._id) }),
    ).resolves.toEqual(0);
    await expect(
      mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(exchange._id) }),
    ).resolves.toEqual(
      expectedDbExchange(tenant, relyingPartyService, depot, exchange, {
        disclosureConsentedAt: undefined,
        err: 'access_denied',
        errorDescription: 'Wallet holder declined presentation sharing',
        events: [
          {
            state: ExchangeStates.NEW,
            timestamp: expect.any(Date),
          },
          {
            state: ExchangeStates.PRESENTATION_REQUEST_REQUESTED,
            timestamp: expect.any(Date),
          },
          {
            state: ExchangeStates.CLIENT_ERROR,
            timestamp: expect.any(Date),
          },
        ],
      }),
    );
  });

  it('should reject a direct-post authorization error response after the request expires', async () => {
    await mongoDb()
      .collection('exchanges')
      .updateOne(
        { _id: new ObjectId(exchange._id) },
        {
          $set: {
            'protocolMetadata.presentationRequestExpiresAt': new Date(
              Date.now() - 1000,
            ),
          },
        },
      );

    const response = await injectDirectPost({
      fastify,
      tenant,
      payload: {
        state: exchange._id.toString(),
        error: 'access_denied',
        error_description: 'Wallet holder declined presentation sharing',
      },
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json()).toEqual({
      error: 'invalid_request',
      error_description: 'OpenID4VP presentation request has expired',
    });
    await expect(
      mongoDb()
        .collection('presentations')
        .countDocuments({ exchangeId: new ObjectId(exchange._id) }),
    ).resolves.toEqual(0);
    await expect(
      mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(exchange._id) }),
    ).resolves.toEqual(
      expectedDbExchange(tenant, relyingPartyService, depot, exchange, {
        disclosureConsentedAt: undefined,
        err: 'openid4vp_presentation_request_expired',
        errorDescription: 'OpenID4VP presentation request has expired',
        protocolMetadata: {
          protocol: ExchangeProtocols.OPENID4VP,
          nonce: 'openid4vp-nonce',
          walletNonce: 'wallet-nonce',
          presentationDefinition: expectedPresentationDefinition(
            relyingPartyService,
            exchange._id,
          ),
          presentationRequestExpiresAt: expect.any(Date),
        },
        events: [
          {
            state: ExchangeStates.NEW,
            timestamp: expect.any(Date),
          },
          {
            state: ExchangeStates.PRESENTATION_REQUEST_REQUESTED,
            timestamp: expect.any(Date),
          },
          {
            state: ExchangeStates.CLIENT_ERROR,
            timestamp: expect.any(Date),
          },
        ],
      }),
    );
  });

  it('should reject a direct-post authorization response after the request expires', async () => {
    await mongoDb()
      .collection('exchanges')
      .updateOne(
        { _id: new ObjectId(exchange._id) },
        {
          $set: {
            'protocolMetadata.presentationRequestExpiresAt': new Date(
              Date.now() - 1000,
            ),
          },
        },
      );
    const vp = await buildVp(tenant, holder, exchange);
    const jwtVp = await generatePresentationJwt(
      vp,
      holder.keyPair.privateKey,
      `${holder.did}#key`,
    );

    const response = await injectDirectPost({
      fastify,
      tenant,
      payload: directPostPayload(exchange, jwtVp, vp),
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json()).toEqual({
      error: 'invalid_request',
      error_description: 'OpenID4VP presentation request has expired',
    });
    await expect(
      mongoDb()
        .collection('presentations')
        .countDocuments({ exchangeId: new ObjectId(exchange._id) }),
    ).resolves.toEqual(0);
    const dbExchange = await mongoDb()
      .collection('exchanges')
      .findOne({ _id: new ObjectId(exchange._id) });
    expect(dbExchange).toEqual(
      expectedDbExchange(tenant, relyingPartyService, depot, exchange, {
        disclosureConsentedAt: undefined,
        err: 'openid4vp_presentation_request_expired',
        errorDescription: 'OpenID4VP presentation request has expired',
        events: [
          {
            state: ExchangeStates.NEW,
            timestamp: expect.any(Date),
          },
          {
            state: ExchangeStates.PRESENTATION_REQUEST_REQUESTED,
            timestamp: expect.any(Date),
          },
          {
            state: ExchangeStates.CLIENT_ERROR,
            timestamp: expect.any(Date),
          },
        ],
      }),
    );
  });

  it('should accept a direct-post authorization response before the persisted request expiry', async () => {
    await mongoDb()
      .collection('exchanges')
      .updateOne(
        { _id: new ObjectId(exchange._id) },
        {
          $set: {
            'protocolMetadata.presentationRequestExpiresAt': new Date(
              Date.now() + 600000,
            ),
          },
        },
      );
    const vp = await buildVp(tenant, holder, exchange);
    const jwtVp = await generatePresentationJwt(
      vp,
      holder.keyPair.privateKey,
      `${holder.did}#key`,
    );

    const response = await injectDirectPost({
      fastify,
      tenant,
      payload: directPostPayload(exchange, jwtVp, vp),
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json()).toEqual({});
  });

  it('should record unexpected processing failures with unexpected exchange state', async () => {
    const error = new Error('downstream parse failed');
    const addState = mock.fn(() => Promise.resolve({}));
    const context = buildPostAuthorizationResponseContext({
      tenant,
      exchange,
      depot,
      relyingPartyService,
      addState,
      parseAuthorizationResponse: () => Promise.reject(error),
    });

    await expect(
      postAuthorizationResponse(
        {
          state: exchange._id.toString(),
          vp_token: 'vp-token',
          presentation_submission: '{}',
        },
        context,
      ),
    ).rejects.toThrow('downstream parse failed');

    expect(addState.mock.calls[0].arguments).toEqual([
      exchange._id,
      ExchangeStates.UNEXPECTED_ERROR,
      {
        err: 'openid4vp_internal_error',
        errorDescription: 'Unexpected OpenID4VP processing error',
      },
    ]);
  });

  it('should not mask the original failure when recording the failure event fails', async () => {
    const error = new Error('downstream parse failed');
    const recordingError = new Error('exchange update failed');
    const logError = mock.fn();
    const addState = mock.fn(() => Promise.reject(recordingError));
    const context = buildPostAuthorizationResponseContext({
      tenant,
      exchange,
      depot,
      relyingPartyService,
      addState,
      logError,
      parseAuthorizationResponse: () => Promise.reject(error),
    });

    await expect(
      postAuthorizationResponse(
        {
          state: exchange._id.toString(),
          vp_token: 'vp-token',
          presentation_submission: '{}',
        },
        context,
      ),
    ).rejects.toThrow('downstream parse failed');

    expect(logError.mock.calls[0].arguments).toEqual([
      {
        err: recordingError,
        exchangeId: exchange._id,
        openid4vpErrorCode: 'openid4vp_internal_error',
      },
    ]);
  });

  it('should reject a duplicate direct-post authorization response after success', async () => {
    const vp = await buildVp(tenant, holder, exchange);
    const jwtVp = await generatePresentationJwt(
      vp,
      holder.keyPair.privateKey,
      `${holder.did}#key`,
    );
    const payload = directPostPayload(exchange, jwtVp, vp);

    const firstResponse = await injectDirectPost({
      fastify,
      tenant,
      payload,
    });
    const secondResponse = await injectDirectPost({
      fastify,
      tenant,
      payload,
    });

    expect(firstResponse.statusCode).toEqual(200);
    expect(secondResponse.statusCode).toEqual(400);
    expect(secondResponse.json()).toEqual({
      error: 'invalid_request',
      error_description: 'OpenID4VP authorization response already processed',
    });
    await expect(
      mongoDb()
        .collection('presentations')
        .countDocuments({ exchangeId: new ObjectId(exchange._id) }),
    ).resolves.toEqual(1);
    await expect(
      mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(exchange._id) }),
    ).resolves.toEqual(
      expectedDbExchange(tenant, relyingPartyService, depot, exchange),
    );
  });

  it('should reject another direct-post after an authorization error response', async () => {
    const errorResponse = await injectDirectPost({
      fastify,
      tenant,
      payload: {
        state: exchange._id.toString(),
        error: 'access_denied',
      },
    });
    const vp = await buildVp(tenant, holder, exchange);
    const jwtVp = await generatePresentationJwt(
      vp,
      holder.keyPair.privateKey,
      `${holder.did}#key`,
    );

    const retryResponse = await injectDirectPost({
      fastify,
      tenant,
      payload: directPostPayload(exchange, jwtVp, vp),
    });

    expect(errorResponse.statusCode).toEqual(200);
    expect(retryResponse.statusCode).toEqual(400);
    expect(retryResponse.json()).toEqual({
      error: 'invalid_request',
      error_description: 'OpenID4VP authorization response already processed',
    });
    await expect(
      mongoDb()
        .collection('presentations')
        .countDocuments({ exchangeId: new ObjectId(exchange._id) }),
    ).resolves.toEqual(0);
    await expect(
      mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(exchange._id) }),
    ).resolves.toEqual(
      expectedDbExchange(tenant, relyingPartyService, depot, exchange, {
        disclosureConsentedAt: undefined,
        err: 'access_denied',
        events: [
          {
            state: ExchangeStates.NEW,
            timestamp: expect.any(Date),
          },
          {
            state: ExchangeStates.PRESENTATION_REQUEST_REQUESTED,
            timestamp: expect.any(Date),
          },
          {
            state: ExchangeStates.CLIENT_ERROR,
            timestamp: expect.any(Date),
          },
        ],
      }),
    );
  });

  it('should reject another direct-post after an unexpected processing failure', async () => {
    await mongoDb()
      .collection('exchanges')
      .updateOne(
        { _id: new ObjectId(exchange._id) },
        {
          $push: {
            events: {
              state: ExchangeStates.UNEXPECTED_ERROR,
              timestamp: new Date(),
            },
          },
          $set: {
            err: 'openid4vp_internal_error',
            errorDescription: 'Unexpected OpenID4VP processing error',
          },
        },
      );
    const vp = await buildVp(tenant, holder, exchange);
    const jwtVp = await generatePresentationJwt(
      vp,
      holder.keyPair.privateKey,
      `${holder.did}#key`,
    );

    const retryResponse = await injectDirectPost({
      fastify,
      tenant,
      payload: directPostPayload(exchange, jwtVp, vp),
    });

    expect(retryResponse.statusCode).toEqual(400);
    expect(retryResponse.json()).toEqual({
      error: 'invalid_request',
      error_description: 'OpenID4VP authorization response already processed',
    });
    await expect(
      mongoDb()
        .collection('presentations')
        .countDocuments({ exchangeId: new ObjectId(exchange._id) }),
    ).resolves.toEqual(0);
  });

  it('should accept a direct-post response with a nested presentation submission path', async () => {
    const baseVp = await buildVp(tenant, holder, exchange);
    const vp = applyOverrides(baseVp, {
      presentation_submission: {
        ...baseVp.presentation_submission,
        descriptor_map: [
          {
            id: 'OpenBadgeCredential',
            path: '$',
            format: 'jwt_vp',
            path_nested: {
              id: 'OpenBadgeCredential',
              path: '$.verifiableCredential[0]',
              format: 'jwt_vc',
            },
          },
        ],
      },
    });
    const jwtVp = await generatePresentationJwt(
      vp,
      holder.keyPair.privateKey,
      `${holder.did}#key`,
    );

    const response = await injectDirectPost({
      fastify,
      tenant,
      payload: directPostPayload(exchange, [jwtVp], vp),
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json()).toEqual({});
  });

  it('should accept a direct-post response with a single-item vp-token nested path', async () => {
    const baseVp = await buildVp(tenant, holder, exchange);
    const vp = applyOverrides(baseVp, {
      presentation_submission: {
        ...baseVp.presentation_submission,
        descriptor_map: [
          {
            id: 'OpenBadgeCredential',
            path: '$[0]',
            format: 'jwt_vp',
            path_nested: {
              id: 'OpenBadgeCredential',
              path: '$.verifiableCredential[0]',
              format: 'jwt_vc',
            },
          },
        ],
      },
    });
    const jwtVp = await generatePresentationJwt(
      vp,
      holder.keyPair.privateKey,
      `${holder.did}#key`,
    );

    const response = await injectDirectPost({
      fastify,
      tenant,
      payload: directPostPayload(exchange, jwtVp, vp),
    });

    expect(response.statusCode).toEqual(200);
    expect(response.json()).toEqual({});
  });

  it('should reject unsupported nested presentation submission paths', async () => {
    const baseVp = await buildVp(tenant, holder, exchange);
    const vp = applyOverrides(baseVp, {
      presentation_submission: {
        ...baseVp.presentation_submission,
        descriptor_map: [
          {
            id: 'OpenBadgeCredential',
            path: '$[1]',
            format: 'jwt_vp',
            path_nested: {
              id: 'OpenBadgeCredential',
              path: '$.verifiableCredential[0]',
              format: 'jwt_vc',
            },
          },
        ],
      },
    });
    const jwtVp = await generatePresentationJwt(
      vp,
      holder.keyPair.privateKey,
      `${holder.did}#key`,
    );

    const response = await injectDirectPost({
      fastify,
      tenant,
      payload: directPostPayload(exchange, jwtVp, vp),
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json()).toEqual({
      error: 'invalid_request',
      error_description:
        'Presentation path descriptor uses an unsupported nested VP-token path',
    });
  });

  it('should reject unsupported nested presentation submission formats', async () => {
    const baseVp = await buildVp(tenant, holder, exchange);
    const vp = applyOverrides(baseVp, {
      presentation_submission: {
        ...baseVp.presentation_submission,
        descriptor_map: [
          {
            id: 'OpenBadgeCredential',
            path: '$',
            format: 'jwt_vp',
            path_nested: {
              id: 'OpenBadgeCredential',
              path: '$.verifiableCredential[0]',
              format: 'ldp_vc',
            },
          },
        ],
      },
    });
    const jwtVp = await generatePresentationJwt(
      vp,
      holder.keyPair.privateKey,
      `${holder.did}#key`,
    );

    const response = await injectDirectPost({
      fastify,
      tenant,
      payload: directPostPayload(exchange, jwtVp, vp),
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json()).toEqual({
      error: 'invalid_request',
      error_description:
        "Velocity Presentation Submission only supports 'jwt_vc' or 'jwt_vp' inputs",
    });
  });

  it('should reject recursive nested presentation submission paths', async () => {
    const baseVp = await buildVp(tenant, holder, exchange);
    const vp = applyOverrides(baseVp, {
      presentation_submission: {
        ...baseVp.presentation_submission,
        descriptor_map: [
          {
            id: 'OpenBadgeCredential',
            path: '$',
            format: 'jwt_vp',
            path_nested: {
              id: 'OpenBadgeCredential',
              path: '$.verifiableCredential[0]',
              format: 'jwt_vc',
              path_nested: {
                id: 'OpenBadgeCredential',
                path: '$',
                format: 'jwt_vc',
              },
            },
          },
        ],
      },
    });
    const jwtVp = await generatePresentationJwt(
      vp,
      holder.keyPair.privateKey,
      `${holder.did}#key`,
    );

    const response = await injectDirectPost({
      fastify,
      tenant,
      payload: directPostPayload(exchange, jwtVp, vp),
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json()).toEqual({
      error: 'invalid_request',
      error_description:
        'Presentation path descriptor uses unsupported recursive nested paths',
    });
  });

  it('should reject more VP tokens than presentation definition input descriptors', async () => {
    const baseVp = await buildVp(tenant, holder, exchange);
    const vp = applyOverrides(baseVp, {
      presentation_submission: {
        ...baseVp.presentation_submission,
        descriptor_map: [
          ...baseVp.presentation_submission.descriptor_map,
          ...baseVp.presentation_submission.descriptor_map,
        ],
      },
    });
    const jwtVp = await generatePresentationJwt(
      vp,
      holder.keyPair.privateKey,
      `${holder.did}#key`,
    );

    const response = await injectDirectPost({
      fastify,
      tenant,
      payload: directPostPayload(exchange, [jwtVp, jwtVp], vp),
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json()).toEqual({
      error: 'invalid_request',
      error_description:
        'OpenID4VP VP token count exceeds presentation definition input descriptor count',
    });
  });

  it('should reject empty VP token arrays', async () => {
    const vp = await buildVp(tenant, holder, exchange);
    const response = await injectDirectPost({
      fastify,
      tenant,
      payload: directPostPayload(exchange, [], vp),
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json()).toEqual({
      error: 'invalid_request',
      error_description: 'OpenID4VP VP token is missing',
    });

    expect(
      await mongoDb()
        .collection('presentations')
        .countDocuments({ exchangeId: new ObjectId(exchange._id) }),
    ).toEqual(0);
  });

  it('should validate empty VP token arrays before exchange lookup', async () => {
    const vp = await buildVp(tenant, holder, exchange);
    const response = await injectDirectPost({
      fastify,
      tenant,
      payload: directPostPayload(new ObjectId(), [], vp),
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json()).toEqual({
      error: 'invalid_request',
      error_description: 'OpenID4VP VP token is missing',
    });
  });

  it('should return an OAuth-shaped validation error when presentation_submission is missing', async () => {
    const vp = await buildVp(tenant, holder, exchange);
    const response = await injectDirectPost({
      fastify,
      tenant,
      payload: {
        state: exchange._id.toString(),
        vp_token: await generatePresentationJwt(
          vp,
          holder.keyPair.privateKey,
          `${holder.did}#key`,
        ),
      },
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json()).toEqual({
      error: 'invalid_request',
      error_description:
        "body must have required property 'presentation_submission'",
    });
  });

  it('should reject malformed state before exchange lookup', async () => {
    const vp = await buildVp(tenant, holder, exchange);
    const response = await injectDirectPost({
      fastify,
      tenant,
      payload: {
        ...directPostPayload(exchange, 'vp-token', vp),
        state: 'not-an-objectid',
      },
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json()).toEqual({
      error: 'invalid_request',
      error_description: 'body/state must match pattern "^[0-9a-fA-F]{24}$"',
    });
  });

  it('should return an OAuth-shaped error when state does not reference an exchange', async () => {
    const vp = await buildVp(tenant, holder, exchange);
    const response = await injectDirectPost({
      fastify,
      tenant,
      payload: directPostPayload(
        new ObjectId(),
        await generatePresentationJwt(
          vp,
          holder.keyPair.privateKey,
          `${holder.did}#key`,
        ),
        vp,
      ),
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json()).toEqual({
      error: 'invalid_request',
      error_description: 'Referenced exchange not found',
    });
  });

  it('should return an OAuth-shaped error when the exchange depot is stale', async () => {
    const vp = await buildVp(tenant, holder, exchange);
    await mongoDb()
      .collection('depots')
      .deleteOne({ _id: new ObjectId(depot._id) });

    const response = await injectDirectPost({
      fastify,
      tenant,
      payload: directPostPayload(
        exchange,
        await generatePresentationJwt(
          vp,
          holder.keyPair.privateKey,
          `${holder.did}#key`,
        ),
        vp,
      ),
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json()).toEqual({
      error: 'invalid_request',
      error_description: 'referenced_depot_not_found',
    });
  });

  it('should return an OAuth-shaped error when the presentation submission mismatches the service', async () => {
    const baseVp = await buildVp(tenant, holder, exchange);
    const vp = applyOverrides(baseVp, {
      presentation_submission: {
        ...baseVp.presentation_submission,
        definition_id: `${exchange._id}.${new ObjectId()}`,
      },
    });
    const response = await injectDirectPost({
      fastify,
      tenant,
      payload: directPostPayload(
        exchange,
        await generatePresentationJwt(
          vp,
          holder.keyPair.privateKey,
          `${holder.did}#key`,
        ),
        vp,
      ),
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json()).toEqual({
      error: 'invalid_request',
      error_description: 'Mismatched Service Ids',
    });
  });

  it('should return an OAuth-shaped error when the presentation nonce is mismatched', async () => {
    const vp = await buildVp(tenant, holder, exchange, {
      nonce: 'wrong-nonce',
    });
    const response = await injectDirectPost({
      fastify,
      tenant,
      payload: directPostPayload(
        exchange,
        await generatePresentationJwt(
          vp,
          holder.keyPair.privateKey,
          `${holder.did}#key`,
        ),
        vp,
      ),
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json()).toEqual({
      error: 'invalid_request',
      error_description: 'OpenID4VP presentation nonce mismatch',
    });
    await expect(
      mongoDb()
        .collection('presentations')
        .countDocuments({ exchangeId: new ObjectId(exchange._id) }),
    ).resolves.toEqual(0);
    await expect(
      mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(exchange._id) }),
    ).resolves.toEqual(
      expectedDbExchange(tenant, relyingPartyService, depot, exchange, {
        disclosureConsentedAt: undefined,
        err: 'openid4vp_presentation_nonce_mismatch',
        errorDescription: 'OpenID4VP presentation nonce mismatch',
        events: [
          {
            state: ExchangeStates.NEW,
            timestamp: expect.any(Date),
          },
          {
            state: ExchangeStates.PRESENTATION_REQUEST_REQUESTED,
            timestamp: expect.any(Date),
          },
          {
            state: ExchangeStates.CLIENT_ERROR,
            timestamp: expect.any(Date),
          },
        ],
      }),
    );
  });

  it('should return an OAuth-shaped error when the presentation verifier is mismatched', async () => {
    const vp = await buildVp(tenant, holder, exchange, {
      verifier: `decentralized_identifier:did:test:${nanoid()}`,
    });
    const response = await injectDirectPost({
      fastify,
      tenant,
      payload: directPostPayload(
        exchange,
        await generatePresentationJwt(
          vp,
          holder.keyPair.privateKey,
          `${holder.did}#key`,
        ),
        vp,
      ),
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json()).toEqual({
      error: 'invalid_request',
      error_description: 'OpenID4VP presentation verifier mismatch',
    });
  });

  it('should return an OAuth-shaped error when the presentation jwt is invalid', async () => {
    const vp = await buildVp(tenant, holder, exchange);
    const jwtVp = await generatePresentationJwt(
      vp,
      holder.keyPair.privateKey,
      `${holder.did}#key`,
    );
    const response = await injectDirectPost({
      fastify,
      tenant,
      payload: directPostPayload(exchange, `${jwtVp}.tampered`, vp),
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json()).toEqual({
      error: 'invalid_request',
      error_description: 'Invalid OpenID4VP presentation',
    });
  });

  it('should not store any presentations when one submitted presentation is invalid', async () => {
    const twoInputPresentationDefinition = applyOverrides(
      exchange.protocolMetadata.presentationDefinition,
      {
        input_descriptors: [
          ...exchange.protocolMetadata.presentationDefinition.input_descriptors,
          {
            ...exchange.protocolMetadata.presentationDefinition
              .input_descriptors[0],
            id: 'OpenBadgeCredential2',
          },
        ],
      },
    );
    await mongoDb()
      .collection('exchanges')
      .updateOne(
        { _id: new ObjectId(exchange._id) },
        {
          $set: {
            'protocolMetadata.presentationDefinition':
              twoInputPresentationDefinition,
          },
        },
      );
    const exchangeWithTwoInputs = applyOverrides(exchange, {
      protocolMetadata: {
        ...exchange.protocolMetadata,
        presentationDefinition: twoInputPresentationDefinition,
      },
    });
    const baseVp = await buildVp(tenant, holder, exchangeWithTwoInputs);
    const validVp = applyOverrides(baseVp, {
      presentation_submission: {
        ...baseVp.presentation_submission,
        descriptor_map: [
          ...baseVp.presentation_submission.descriptor_map,
          {
            ...baseVp.presentation_submission.descriptor_map[0],
            id: 'OpenBadgeCredential2',
          },
        ],
      },
    });
    const invalidVp = applyOverrides(validVp, {
      nonce: 'wrong-nonce',
    });

    const response = await injectDirectPost({
      fastify,
      tenant,
      payload: directPostPayload(
        exchange,
        [
          await generatePresentationJwt(
            validVp,
            holder.keyPair.privateKey,
            `${holder.did}#key`,
          ),
          await generatePresentationJwt(
            invalidVp,
            holder.keyPair.privateKey,
            `${holder.did}#key`,
          ),
        ],
        validVp,
      ),
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json()).toEqual({
      error: 'invalid_request',
      error_description: 'OpenID4VP presentation nonce mismatch',
    });

    await expect(
      mongoDb()
        .collection('presentations')
        .countDocuments({ exchangeId: new ObjectId(exchange._id) }),
    ).resolves.toEqual(0);
    await expect(
      mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(exchange._id) }),
    ).resolves.toEqual(
      expectedDbExchange(tenant, relyingPartyService, depot, exchange, {
        disclosureConsentedAt: undefined,
        err: 'openid4vp_presentation_nonce_mismatch',
        errorDescription: 'OpenID4VP presentation nonce mismatch',
        protocolMetadata: {
          protocol: ExchangeProtocols.OPENID4VP,
          nonce: 'openid4vp-nonce',
          walletNonce: 'wallet-nonce',
          presentationDefinition: twoInputPresentationDefinition,
          presentationRequestExpiresAt: expect.any(Date),
        },
        events: [
          { state: ExchangeStates.NEW, timestamp: expect.any(Date) },
          {
            state: ExchangeStates.PRESENTATION_REQUEST_REQUESTED,
            timestamp: expect.any(Date),
          },
          {
            state: ExchangeStates.CLIENT_ERROR,
            timestamp: expect.any(Date),
          },
        ],
      }),
    );
  });

  it('should return an OAuth-shaped error when exchange protocol is not OpenID4VP', async () => {
    const vnApiExchange = await persistExchange({
      tenant,
      service: relyingPartyService,
      depotId: new ObjectId(depot._id),
      protocolMetadata: {
        protocol: ExchangeProtocols.VN_API,
      },
    });
    const vp = await buildVp(tenant, holder, vnApiExchange);
    const response = await injectDirectPost({
      fastify,
      tenant,
      payload: directPostPayload(
        vnApiExchange,
        await generatePresentationJwt(
          vp,
          holder.keyPair.privateKey,
          `${holder.did}#key`,
        ),
        vp,
      ),
    });

    expect(response.statusCode).toEqual(400);
    expect(response.json()).toEqual({
      error: 'invalid_request',
      error_description: 'Referenced exchange is not an OpenID4VP exchange',
    });
  });
});

const injectDirectPost = ({ fastify, tenant, payload }) =>
  fastify.inject({
    method: 'POST',
    url: `/r/${tenant._id}/openid4vp/direct-post`,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(payload).toString(),
  });

const buildPostAuthorizationResponseContext = ({
  tenant,
  exchange,
  depot,
  relyingPartyService,
  addState,
  logError = mock.fn(),
  parseAuthorizationResponse,
}) => ({
  tenant,
  log: {
    error: logError,
  },
  repos: {
    exchanges: {
      findOne: mock.fn(() =>
        Promise.resolve(
          applyOverrides(exchange, {
            protocolMetadata: {
              ...exchange.protocolMetadata,
              presentationRequestExpiresAt: new Date(Date.now() + 600000),
            },
          }),
        ),
      ),
      addState,
    },
    depots: {
      findOne: mock.fn(() => Promise.resolve(depot)),
    },
    relyingPartyServices: {
      findOne: mock.fn(() => Promise.resolve(relyingPartyService)),
    },
  },
  getOpenId4VpVerifier: mock.fn(() =>
    Promise.resolve({
      parseAuthorizationResponse,
    }),
  ),
});

const directPostPayload = (exchange, jwtVp, vp) => ({
  state: (exchange._id ?? exchange).toString(),
  vp_token: Array.isArray(jwtVp) ? JSON.stringify(jwtVp) : jwtVp,
  presentation_submission: JSON.stringify(vp.presentation_submission),
});

const generateHolder = () => {
  const keyPair = generateKeyPair({ format: 'jwk' });
  return {
    keyPair,
    did: getDidUriFromJwk(keyPair.publicKey),
  };
};

const buildVp = async (tenant, holder, exchange, overrides = {}) => {
  const vcKeyPair = generateKeyPair({ format: 'jwk' });
  const credentialDid = 'did:velocity:v2:A:1:1';
  const openBadgeCredential = buildOpenBadgeCredential(
    tenant,
    credentialDid,
    holder.did,
  );
  const vc = await generateCredentialJwt(
    openBadgeCredential,
    vcKeyPair.privateKey,
    `${credentialDid}#key-1`,
  );

  return applyOverrides(
    {
      '@context': 'https://www.w3.org/2018/credentials/v1',
      id: nanoid(),
      verifiableCredential: [vc],
      issuer: holder.did,
      verifier: `decentralized_identifier:${tenant.did}`,
      nonce: exchange.protocolMetadata.nonce,
      presentation_submission: {
        id: nanoid(),
        definition_id: `${exchange._id}.${exchange.serviceId}`,
        descriptor_map: mapWithIndex(
          (c, i) => ({
            id: 'OpenBadgeCredential',
            path: `$.verifiableCredential[${i}]`,
            format: 'jwt_vc',
          }),
          [vc],
        ),
      },
    },
    overrides,
  );
};

const expectedDbPresentation = (tenant, exchange, jwtVp) => ({
  _id: expect.any(ObjectId),
  exchangeId: new ObjectId(exchange._id),
  depotId: new ObjectId(exchange.depotId),
  tenantId: new ObjectId(tenant._id),
  format: PresentationFormat.JWT_VP,
  presentation: jwtVp,
  createdAt: expect.any(Date),
  updatedAt: expect.any(Date),
});

const expectedDbExchange = (
  tenant,
  relyingPartyService,
  depot,
  exchange,
  overrides = {},
) =>
  applyOverrides(
    {
      _id: new ObjectId(exchange._id),
      tenantId: new ObjectId(tenant._id),
      serviceId: new ObjectId(relyingPartyService._id),
      depotId: new ObjectId(depot._id),
      disclosureConsentedAt: expect.any(Date),
      protocolMetadata: {
        protocol: ExchangeProtocols.OPENID4VP,
        nonce: 'openid4vp-nonce',
        walletNonce: 'wallet-nonce',
        presentationDefinition: expectedPresentationDefinition(
          relyingPartyService,
          exchange._id,
        ),
        presentationRequestExpiresAt: expect.any(Date),
      },
      type: ExchangeTypes.RELYING_PARTY,
      events: [
        {
          state: ExchangeStates.NEW,
          timestamp: expect.any(Date),
        },
        {
          state: ExchangeStates.PRESENTATION_REQUEST_REQUESTED,
          timestamp: expect.any(Date),
        },
        {
          state: ExchangeStates.PRESENTATION_SUBMISSION_RECEIVED,
          timestamp: expect.any(Date),
        },
      ],
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    },
    overrides,
  );

const inputDescriptor = (type, group = ['A']) => ({
  ...descriptors[type],
  group,
});

const descriptors = {
  OpenBadgeCredential: {
    id: 'OpenBadgeCredential',
    name: 'OpenBadgeCredential',
    schema: [
      {
        uri: 'https://example.com/OpenBadgeCredential.json',
      },
    ],
  },
};

const expectedPresentationDefinition = (relyingPartyService, exchangeId) => ({
  id: `${exchangeId}.${relyingPartyService._id}`,
  name: relyingPartyService.description,
  purpose: relyingPartyService.disclosureRequest?.purpose ?? '',
  format: {
    jwt_vp: { alg: ['secp256k1'] },
  },
  input_descriptors: [inputDescriptor('OpenBadgeCredential')],
  submission_requirements: [
    {
      rule: 'pick',
      from: 'A',
      min: 1,
    },
  ],
});
