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
const { after, before, beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');
const { ObjectId } = require('mongodb');
const { mongoDb, tableRegistry } = require('@spencejs/spence-mongo-repos');
const { mapWithIndex } = require('@verii/common-functions');
const { generateKeyPair } = require('@verii/crypto');
const {
  jwtVerify,
  generateCredentialJwt,
  generatePresentationJwt,
} = require('@verii/jwt');
const { errorResponseMatcher } = require('@verii/tests-helpers');
const { VeriiProtocolVersions } = require('@verii/vc-checks');
const { map, set, unset } = require('lodash/fp');
const { nanoid } = require('nanoid');
const nock = require('nock').default;
const { getDidUriFromJwk } = require('@verii/did-doc');
const qs = require('qs');
const {
  applyOverrides,
} = require('@verii/common-functions/src/apply-overrides');
const { resetMockHttpClient } = require('../helpers/mock-http-client');
const {
  initDepotFactory,
} = require('../../src/entities/depots/factories/depot-factory');
const {
  initRelyingPartyServiceFactory,
} = require('../../src/entities/relying-party-services');
const { initTenantFactory } = require('../../src/entities/tenants');
const { initKeyFactory } = require('../../src/entities/keys');
const {
  ExchangeProtocols,
  ExchangeTypes,
  initExchangeFactory,
} = require('../../src/entities/exchanges');
const createTestFastify = require('../helpers/create-test-fastify');
const { constructTenant } = require('../helpers/construct-tenant');
const {
  buildOpenBadgeCredential,
} = require('../helpers/build-open-badge-credential');
const {
  PresentationFormat,
} = require('../../src/entities/presentations/domain/presentation-format');
const { NotificationEventTypes } = require('../../src/entities/notifications');

const vnUrl = ({ did }) => `/vn-api/r/${did}`;

const testUrl = (tenant, queryParams) => {
  const baseUrl = `${vnUrl(tenant)}/presentation`;
  const queryString = qs.stringify(queryParams, { indices: false });
  return `${baseUrl}?${queryString}`;
};

describe('vn-api > presentations', () => {
  let fastify;
  let persistTenant;
  let persistRelyingPartyService;
  let persistDepot;
  let persistExchange;
  let persistKey;
  let tenant;
  let holderAccessTokensSecret;

  before(async () => {
    fastify = createTestFastify();
    await fastify.ready();
    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistKey } = initKeyFactory(fastify));
    ({ persistRelyingPartyService } = initRelyingPartyServiceFactory(fastify));
    ({ persistDepot } = initDepotFactory(fastify));
    ({ persistExchange } = initExchangeFactory(fastify));

    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});
    ({ tenant, holderAccessTokensSecret } = await constructTenant(
      persistTenant,
      persistKey,
    ));
  });

  let relyingPartyService;
  let depot;
  let exchange;
  let holder;

  const generateHolder = () => {
    const keyPair = generateKeyPair({ format: 'jwk' });
    return {
      keyPair,
      did: getDidUriFromJwk(keyPair.publicKey),
    };
  };

  beforeEach(async () => {
    fastify.resetOverrides();
    await mongoDb().collection('relyingPartyServices').deleteMany({});
    await mongoDb().collection('exchanges').deleteMany({});
    await mongoDb().collection('depots').deleteMany({});
    await mongoDb().collection('presentations').deleteMany({});
    await mongoDb().collection('notification_events').deleteMany({});
    resetMockHttpClient();
    relyingPartyService = await persistRelyingPartyService({
      tenant,
    });
    depot = await persistDepot({ tenant, service: relyingPartyService });
    exchange = await persistExchange({
      tenant,
      service: relyingPartyService,
      depotId: new ObjectId(depot._id),
      protocolMetadata: {
        protocol: ExchangeProtocols.VN_API,
      },
      type: ExchangeTypes.RELYING_PARTY,
    });
    holder = generateHolder();

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

  after(async () => {
    await fastify.close();
    nock.cleanAll();
    nock.restore();
    mock.reset();
  });

  describe('presentation tests', () => {
    describe('error test cases', () => {
      it('should 500 if the jwt is invalid', async () => {
        const response = await fastify.injectJson({
          method: 'POST',
          url: testUrl(tenant),
          payload: { exchange_id: exchange._id, jwt_vp: 'BAD JWT' },
        });
        expect(response.statusCode).toEqual(500);
      });
      it('should 400 if the presentation_submission is invalid', async () => {
        const vpWrapper = await buildVpWrapper(tenant, holder, exchange);
        const modifiedVp = unset(
          'presentation_submission.descriptor_map',
          vpWrapper.vp,
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: testUrl(tenant),
          payload: {
            exchange_id: exchange._id,
            jwt_vp: await vpWrapper.jwtVp(modifiedVp),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual({
          error: 'Bad Request',
          errorCode: 'request_validation_failed',
          message:
            "presentation_submission must have required property 'descriptor_map'",
          requestId: expect.any(String),
          statusCode: 400,
        });
      });
      it('should 400 if the exchange id mismatched', async () => {
        const vpWrapper = await buildVpWrapper(tenant, holder, exchange);
        const modifiedVp = set(
          'presentation_submission.definition_id',
          `${new ObjectId()}.${exchange.serviceId}`,
          vpWrapper.vp,
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: testUrl(tenant),

          payload: {
            exchange_id: exchange._id,
            jwt_vp: await vpWrapper.jwtVp(modifiedVp),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual({
          error: 'Bad Request',
          errorCode: 'presentation_mismatch_exchange',
          message: 'Mismatched Exchange Ids',
          requestId: expect.any(String),
          statusCode: 400,
        });
      });
      it('should 400 if the service id mismatched', async () => {
        const vpWrapper = await buildVpWrapper(tenant, holder, exchange);
        const modifiedVp = set(
          'presentation_submission.definition_id',
          `${exchange._id}.${new ObjectId()}`,
          vpWrapper.vp,
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: testUrl(tenant),

          payload: {
            exchange_id: exchange._id,
            jwt_vp: await vpWrapper.jwtVp(modifiedVp),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual({
          error: 'Bad Request',
          errorCode: 'presentation_mismatch_service',
          message: 'Mismatched Service Ids',
          requestId: expect.any(String),
          statusCode: 400,
        });
      });
      it("should 400 if the presentation contains an input descriptor that isn't a jwt_vc format", async () => {
        const vpWrapper = await buildVpWrapper(tenant, holder, exchange);
        const modifiedVp = set(
          'presentation_submission.descriptor_map[0]',
          {
            id: nanoid(),
            path: '$.verifiableCredential[0]',
            format: 'jwt',
          },
          vpWrapper.vp,
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: testUrl(tenant),

          payload: {
            exchange_id: exchange._id,
            jwt_vp: await vpWrapper.jwtVp(modifiedVp),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual({
          error: 'Bad Request',
          errorCode: 'presentation_missing_jwtvc_or_jwtvp',
          message:
            "Velocity Presentation Submission only supports 'jwt_vc' or 'jwt_vp' inputs",
          requestId: expect.any(String),
          statusCode: 400,
        });
      });
      it('should 400 if the input descriptor path doesnt dereference anything', async () => {
        const vpWrapper = await buildVpWrapper(tenant, holder, exchange);
        const modifiedVp = set(
          'presentation_submission.descriptor_map[0]',
          {
            id: nanoid(),
            path: '$.verifiableCredential[1]',
            format: 'jwt_vc',
          },
          vpWrapper.vp,
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: testUrl(tenant),

          payload: {
            exchange_id: exchange._id,
            jwt_vp: await vpWrapper.jwtVp(modifiedVp),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual({
          error: 'Bad Request',
          errorCode: 'presentation_jsonpath_empty',
          message:
            'Presentation path descriptor does not reference any valid data: JSONPath expression returned no results',
          requestId: expect.any(String),
          statusCode: 400,
        });
      });
      it('should 400 if the input descriptor path only dereferences submission metadata', async () => {
        const vpWrapper = await buildVpWrapper(tenant, holder, exchange);
        const modifiedVp = set(
          'presentation_submission.descriptor_map[0]',
          {
            id: nanoid(),
            path: '$.presentation_submission.id',
            format: 'jwt_vc',
          },
          vpWrapper.vp,
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: testUrl(tenant),

          payload: {
            exchange_id: exchange._id,
            jwt_vp: await vpWrapper.jwtVp(modifiedVp),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual({
          error: 'Bad Request',
          errorCode: 'presentation_jsonpath_empty',
          message:
            'Presentation path descriptor does not reference any valid data: JSONPath expression returned no results',
          requestId: expect.any(String),
          statusCode: 400,
        });
      });
      it('should 400 if the relying party service is deactivated', async () => {
        fastify.overrides.reqConfig = (config) => ({
          ...config,
          enableDeactivatedDisclosure: true,
        });
        const relyingPartyService2 = await persistRelyingPartyService({
          tenant,
          deactivationDate: '2000-12-01T00:00:00.000Z',
        });
        const exchange2 = await persistExchange({
          tenant,
          service: relyingPartyService2,
          type: ExchangeTypes.RELYING_PARTY,
          protocolMetadata: {
            protocol: ExchangeProtocols.VN_API,
          },
        });
        const vpWrapper = await buildVpWrapper(tenant, holder, exchange2);

        const response = await fastify.injectJson({
          method: 'POST',
          url: testUrl(tenant),
          payload: {
            exchange_id: exchange2._id,
            jwt_vp: await vpWrapper.jwtVp(),
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'referenced_service_not_found',
            message: 'referenced_service_not_found',
            statusCode: 400,
          }),
        );
      });
      it('should 400 when @context is a string and is incorrect value', async () => {
        const vpWrapper = await buildVpWrapper(tenant, holder, exchange);
        const modifiedVp = set('@context', 'foo', vpWrapper.vp);
        const response = await fastify.injectJson({
          method: 'POST',
          url: testUrl(tenant),
          payload: {
            exchange_id: exchange._id,
            jwt_vp: await vpWrapper.jwtVp(modifiedVp),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            message: 'presentation @context is invalid',
            statusCode: 400,
            errorCode: 'presentation_invalid',
          }),
        );
      });
      it('should 400 when @context is an array and is incorrect value', async () => {
        const vpWrapper = await buildVpWrapper(tenant, holder, exchange);
        const modifiedVp = set('@context', ['foo'], vpWrapper.vp);

        const response = await fastify.injectJson({
          method: 'POST',
          url: testUrl(tenant),
          payload: {
            exchange_id: exchange._id,
            jwt_vp: await vpWrapper.jwtVp(modifiedVp),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            message: 'presentation @context is invalid',
            statusCode: 400,
            errorCode: 'presentation_invalid',
          }),
        );
      });
      it('should 400 when @context is an empty array', async () => {
        const vpWrapper = await buildVpWrapper(tenant, holder, exchange);
        const modifiedVp = set('@context', [], vpWrapper.vp);

        const response = await fastify.injectJson({
          method: 'POST',
          url: testUrl(tenant),
          payload: {
            exchange_id: exchange._id,
            jwt_vp: await vpWrapper.jwtVp(modifiedVp),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            message: 'presentation @context is invalid',
            statusCode: 400,
            errorCode: 'presentation_invalid',
          }),
        );
      });
      it('should 400 if the presentation submission is a self signed vp', async () => {
        const vpWrapper = await buildVpWrapper(tenant, holder, exchange);
        const jwtVp = await vpWrapper.selfSignedJwtVp();

        const response = await fastify.injectJson({
          method: 'POST',
          url: testUrl(tenant),
          payload: {
            exchange_id: exchange._id,
            jwt_vp: jwtVp,
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual({
          error: 'Bad Request',
          errorCode: 'presentation_malformed',
          message: 'jwt_vp must not be self signed',
          requestId: expect.any(String),
          statusCode: 400,
        });
      });
    });

    describe('success test cases', () => {
      it('should 200 if the did:jwk signed presentation submission', async () => {
        const vpWrapper = await buildVpWrapper(tenant, holder, exchange);
        const jwtVp = await vpWrapper.jwtVp();

        const response = await fastify.injectJson({
          method: 'POST',
          url: testUrl(tenant),
          headers: {
            'x-vnf-protocol-version': `${VeriiProtocolVersions.PROTOCOL_VERSION_2}`,
          },
          payload: {
            exchange_id: exchange._id,
            jwt_vp: jwtVp,
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          exchange: {
            id: exchange._id,
            type: 'DISCLOSURE',
            disclosureComplete: true,
            exchangeComplete: true,
          },
          token: expect.any(String),
        });

        await expect(
          jwtVerify(response.json.token, holderAccessTokensSecret),
        ).resolves.toEqual(expectedAccessToken(tenant, exchange));
        await expect(
          mongoDb()
            .collection('exchanges')
            .findOne({ _id: new ObjectId(exchange._id) }),
        ).resolves.toEqual(
          expectedDbExchange(tenant, relyingPartyService, depot, exchange),
        );
        await expect(
          mongoDb()
            .collection('depots')
            .findOne({ _id: new ObjectId(depot._id) }),
        ).resolves.toEqual(expectedDbDepot(tenant, relyingPartyService, depot));
        await expect(
          mongoDb()
            .collection('presentations')
            .find({ depotId: new ObjectId(depot._id) })
            .toArray(),
        ).resolves.toEqual([expectedDbPresentation(tenant, exchange, jwtVp)]);
        await expect(
          mongoDb().collection('notification_events').countDocuments({}),
        ).resolves.toEqual(0);
      });
      it('should enqueue presentation notification events when notifications are enabled', async () => {
        fastify.overrides.reqConfig = enableNotifications([
          NotificationEventTypes.PRESENTATION_RECEIVED,
        ]);
        const vpWrapper = await buildVpWrapper(tenant, holder, exchange);
        const jwtVp = await vpWrapper.jwtVp();

        const response = await fastify.injectJson({
          method: 'POST',
          url: testUrl(tenant),
          payload: {
            exchange_id: exchange._id,
            jwt_vp: jwtVp,
          },
        });

        expect(response.statusCode).toEqual(200);

        await expect(
          mongoDb().collection('notification_events').find({}).toArray(),
        ).resolves.toEqual([
          expect.objectContaining({
            _id: expect.stringMatching(/^evt_/),
            type: NotificationEventTypes.PRESENTATION_RECEIVED,
            version: 1,
            status: 'pending',
            attempts: 0,
            nextAttemptAt: expect.any(Date),
            lockedBy: null,
            lockedUntil: null,
            lastError: null,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
            deliveredAt: null,
            deadAt: null,
            retentionExpiresAt: null,
            payload: expect.objectContaining({
              id: expect.stringMatching(/^evt_/),
              type: NotificationEventTypes.PRESENTATION_RECEIVED,
              version: 1,
              occurredAt: expect.any(String),
              tenantId: tenant._id,
              tenantDid: tenant.did,
              serviceId: relyingPartyService._id,
              depotId: depot._id,
              exchangeId: exchange._id,
              resource: {
                type: 'presentation',
                id: expect.any(String),
              },
              data: {
                format: PresentationFormat.JWT_VP,
                verificationStatus: 'received',
              },
            }),
          }),
        ]);
        const [event] = await mongoDb()
          .collection('notification_events')
          .find({})
          .toArray();
        expect(JSON.stringify(event.payload)).not.toContain(jwtVp);
      });
      it('should skip presentation notifications filtered out by event type config', async () => {
        fastify.overrides.reqConfig = enableNotifications([
          NotificationEventTypes.CREDENTIAL_ISSUED,
        ]);
        const vpWrapper = await buildVpWrapper(tenant, holder, exchange);

        const response = await fastify.injectJson({
          method: 'POST',
          url: testUrl(tenant),
          payload: {
            exchange_id: exchange._id,
            jwt_vp: await vpWrapper.jwtVp(),
          },
        });

        expect(response.statusCode).toEqual(200);
        await expect(
          mongoDb().collection('notification_events').countDocuments({}),
        ).resolves.toEqual(0);
      });
      it('should not fail presentation submission when notification enqueue fails', async () => {
        fastify.overrides.reqConfig = enableNotifications([
          NotificationEventTypes.PRESENTATION_RECEIVED,
        ]);
        const originalRepoFactory = tableRegistry.notification_events;
        const insertEvents = mock.fn(() =>
          Promise.reject(new Error('outbox unavailable')),
        );
        tableRegistry.notification_events = (context) => ({
          ...originalRepoFactory(context),
          insertEvents,
        });

        try {
          const vpWrapper = await buildVpWrapper(tenant, holder, exchange);
          const response = await fastify.injectJson({
            method: 'POST',
            url: testUrl(tenant),
            payload: {
              exchange_id: exchange._id,
              jwt_vp: await vpWrapper.jwtVp(),
            },
          });

          expect(response.statusCode).toEqual(200);
          expect(insertEvents.mock.callCount()).toEqual(1);
          await expect(
            mongoDb().collection('notification_events').countDocuments({}),
          ).resolves.toEqual(0);
        } finally {
          tableRegistry.notification_events = originalRepoFactory;
        }
      });
      it('should 200 and set the accessToken expiration from authTokensExpireIn', async () => {
        const relyingPartyService2 = await persistRelyingPartyService({
          tenant,
          authTokensExpireIn: 5,
        });
        const depot2 = await persistDepot({
          tenant,
          service: relyingPartyService2,
        });
        const exchange2 = await persistExchange({
          tenant,
          service: relyingPartyService2,
          depotId: new ObjectId(depot2._id),
          type: ExchangeTypes.RELYING_PARTY,
          protocolMetadata: {
            protocol: ExchangeProtocols.VN_API,
          },
        });
        const vpWrapper = await buildVpWrapper(tenant, holder, exchange2);
        const jwtVp = await vpWrapper.jwtVp();

        const response = await fastify.injectJson({
          method: 'POST',
          url: testUrl(tenant),
          payload: {
            exchange_id: exchange2._id,
            jwt_vp: jwtVp,
          },
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          exchange: {
            id: exchange2._id,
            type: 'DISCLOSURE',
            disclosureComplete: true,
            exchangeComplete: true,
          },
          token: expect.any(String),
        });

        const accessToken = await jwtVerify(
          response.json.token,
          holderAccessTokensSecret,
        );
        expect(accessToken).toEqual(expectedAccessToken(tenant, exchange2));
        expect(accessToken.payload.exp).toBeLessThanOrEqual(
          Date.now() / 1000 + 5 * 60,
        );

        await expect(
          mongoDb()
            .collection('exchanges')
            .findOne({ _id: new ObjectId(exchange2._id) }),
        ).resolves.toEqual(
          expectedDbExchange(tenant, relyingPartyService2, depot2, exchange2),
        );
        await expect(
          mongoDb()
            .collection('depots')
            .findOne({ _id: new ObjectId(depot2._id) }),
        ).resolves.toEqual(
          expectedDbDepot(tenant, relyingPartyService2, depot2),
        );

        await expect(
          mongoDb()
            .collection('presentations')
            .find({ depotId: new ObjectId(depot2._id) })
            .toArray(),
        ).resolves.toEqual([expectedDbPresentation(tenant, exchange2, jwtVp)]);
      });
      it('should 200 on 2 different presentation submissions', async () => {
        const exchange2 = await persistExchange({
          tenant,
          service: relyingPartyService,
          depotId: new ObjectId(depot._id),
          type: ExchangeTypes.RELYING_PARTY,
          protocolMetadata: {
            protocol: ExchangeProtocols.VN_API,
          },
        });
        const vpWrappers = await Promise.all([
          buildVpWrapper(tenant, holder, exchange),
          buildVpWrapper(tenant, holder, exchange2),
        ]);
        const jwtVps = await Promise.all(
          map((vpWrapper) => vpWrapper.jwtVp(), vpWrappers),
        );

        const response = await fastify.injectJson({
          method: 'POST',
          url: testUrl(tenant),
          payload: {
            exchange_id: exchange._id,
            jwt_vp: jwtVps[0],
          },
        });
        expect(response.statusCode).toEqual(200);

        const response2 = await fastify.injectJson({
          method: 'POST',
          url: testUrl(tenant),
          payload: {
            exchange_id: exchange2._id,
            jwt_vp: jwtVps[1],
          },
        });
        expect(response2.statusCode).toEqual(200);

        await expect(
          mongoDb()
            .collection('exchanges')
            .findOne({ _id: new ObjectId(exchange._id) }),
        ).resolves.toEqual(
          expectedDbExchange(tenant, relyingPartyService, depot, exchange),
        );
        await expect(
          mongoDb()
            .collection('exchanges')
            .findOne({ _id: new ObjectId(exchange2._id) }),
        ).resolves.toEqual(
          expectedDbExchange(tenant, relyingPartyService, depot, exchange2),
        );
        await expect(
          mongoDb()
            .collection('depots')
            .findOne({ _id: new ObjectId(depot._id) }),
        ).resolves.toEqual(expectedDbDepot(tenant, relyingPartyService, depot));

        await expect(
          mongoDb()
            .collection('presentations')
            .find({ depotId: new ObjectId(depot._id) })
            .toArray(),
        ).resolves.toEqual(
          expect.arrayContaining([
            expectedDbPresentation(tenant, exchange, jwtVps[0]),
            expectedDbPresentation(tenant, exchange2, jwtVps[1]),
          ]),
        );
      });
      it('should 200 on 2 different presentation submissions on a feed', async () => {
        const relyingPartyFeedService = await persistRelyingPartyService({
          tenant,
          mode: 'feed',
        });
        const feedDepot = await persistDepot({
          tenant,
          service: relyingPartyFeedService,
        });
        const feedExchange1 = await persistExchange({
          tenant,
          service: relyingPartyFeedService,
          depotId: new ObjectId(feedDepot._id),
          type: ExchangeTypes.RELYING_PARTY,
          protocolMetadata: {
            protocol: ExchangeProtocols.VN_API,
          },
        });
        const feedExchange2 = await persistExchange({
          tenant,
          service: relyingPartyFeedService,
          depotId: new ObjectId(feedDepot._id),
          type: ExchangeTypes.RELYING_PARTY,
          protocolMetadata: {
            protocol: ExchangeProtocols.VN_API,
          },
        });
        const vpWrappers = await Promise.all([
          buildVpWrapper(tenant, holder, feedExchange1),
          buildVpWrapper(tenant, holder, feedExchange2),
        ]);
        const jwtVps = await Promise.all(
          map((vpWrapper) => vpWrapper.jwtVp(), vpWrappers),
        );

        const response = await fastify.injectJson({
          method: 'POST',
          url: testUrl(tenant, '/submit-presentation'),
          payload: {
            exchange_id: feedExchange1._id,
            jwt_vp: jwtVps[0],
          },
        });
        expect(response.statusCode).toEqual(200);

        const response2 = await fastify.injectJson({
          method: 'POST',
          url: testUrl(tenant, '/submit-presentation'),
          payload: {
            exchange_id: feedExchange2._id,
            jwt_vp: jwtVps[1],
          },
        });
        expect(response2.statusCode).toEqual(200);

        await expect(
          mongoDb()
            .collection('exchanges')
            .findOne({ _id: new ObjectId(feedExchange1._id) }),
        ).resolves.toEqual(
          expectedDbExchange(
            tenant,
            relyingPartyFeedService,
            feedDepot,
            feedExchange1,
          ),
        );
        await expect(
          mongoDb()
            .collection('exchanges')
            .findOne({ _id: new ObjectId(feedExchange2._id) }),
        ).resolves.toEqual(
          expectedDbExchange(
            tenant,
            relyingPartyFeedService,
            feedDepot,
            feedExchange2,
          ),
        );
        await expect(
          mongoDb()
            .collection('depots')
            .findOne({ _id: new ObjectId(feedDepot._id) }),
        ).resolves.toEqual(
          expectedDbDepot(tenant, relyingPartyFeedService, feedDepot),
        );

        await expect(
          mongoDb()
            .collection('presentations')
            .find({ depotId: new ObjectId(feedDepot._id) })
            .toArray(),
        ).resolves.toEqual(
          expect.arrayContaining([
            expectedDbPresentation(tenant, feedExchange1, jwtVps[0]),
            expectedDbPresentation(tenant, feedExchange2, jwtVps[1]),
          ]),
        );
      });
      it('should 200 if the presentation submission maps to a standard vp and contains a vendorOriginContext', async () => {
        const vpWrapper = await buildVpWrapper(tenant, holder, exchange, {
          'presentation.vendorOriginContext': '123',
        });
        const jwtVp = await vpWrapper.jwtVp();

        const response = await fastify.injectJson({
          method: 'POST',
          url: testUrl(tenant),
          payload: {
            exchange_id: exchange._id,
            jwt_vp: jwtVp,
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          exchange: {
            id: exchange._id,
            type: 'DISCLOSURE',
            disclosureComplete: true,
            exchangeComplete: true,
          },
          token: expect.any(String),
        });

        await expect(
          jwtVerify(response.json.token, holderAccessTokensSecret),
        ).resolves.toEqual(expectedAccessToken(tenant, exchange));
        await expect(
          mongoDb()
            .collection('exchanges')
            .findOne({ _id: new ObjectId(exchange._id) }),
        ).resolves.toEqual(
          expectedDbExchange(tenant, relyingPartyService, depot, exchange),
        );
        await expect(
          mongoDb()
            .collection('depots')
            .findOne({ _id: new ObjectId(depot._id) }),
        ).resolves.toEqual(expectedDbDepot(tenant, relyingPartyService, depot));

        await expect(
          mongoDb()
            .collection('presentations')
            .find({ depotId: new ObjectId(depot._id) })
            .toArray(),
        ).resolves.toEqual([expectedDbPresentation(tenant, exchange, jwtVp)]);
      });
      it('should 200 when @context is an array and is correct value', async () => {
        const vpWrapper = await buildVpWrapper(tenant, holder, exchange, {
          '@context': [
            'https://www.w3.org/ns/credentials/v2',
            'https://www.w3.org/ns/credentials/v2/examples',
            'https://example.org/context',
          ],
        });
        const jwtVp = await vpWrapper.jwtVp();

        const response = await fastify.injectJson({
          method: 'POST',
          url: testUrl(tenant),
          payload: {
            exchange_id: exchange._id,
            jwt_vp: jwtVp,
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          exchange: {
            id: exchange._id,
            type: 'DISCLOSURE',
            disclosureComplete: true,
            exchangeComplete: true,
          },
          token: expect.any(String),
        });

        await expect(
          jwtVerify(response.json.token, holderAccessTokensSecret),
        ).resolves.toEqual(expectedAccessToken(tenant, exchange));
        await expect(
          mongoDb()
            .collection('exchanges')
            .findOne({ _id: new ObjectId(exchange._id) }),
        ).resolves.toEqual(
          expectedDbExchange(tenant, relyingPartyService, depot, exchange),
        );
        await expect(
          mongoDb()
            .collection('depots')
            .findOne({ _id: new ObjectId(depot._id) }),
        ).resolves.toEqual(expectedDbDepot(tenant, relyingPartyService, depot));

        await expect(
          mongoDb()
            .collection('presentations')
            .find({ depotId: new ObjectId(depot._id) })
            .toArray(),
        ).resolves.toEqual([expectedDbPresentation(tenant, exchange, jwtVp)]);
      });
    });
  });
});

const buildVpWrapper = async (tenant, holder, exchange, overrides = {}) => {
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

  const vp = applyOverrides(
    {
      '@context': 'https://www.w3.org/2018/credentials/v1',
      id: nanoid(),
      verifiableCredential: [vc],
      issuer: holder.did,
      presentation_submission: {
        id: nanoid(),
        definition_id: `${exchange._id}.${exchange.serviceId}`,
        descriptor_map: mapWithIndex(
          (c, i) => ({
            id: nanoid(),
            path: `$.verifiableCredential[${i}]`,
            format: 'jwt_vc',
          }),
          [vc],
        ),
      },
    },
    overrides,
  );

  return {
    vp,
    jwtVp: (overrideVp, overrideKeyPair) =>
      generatePresentationJwt(
        overrideVp ?? vp,
        overrideKeyPair?.privateKey ?? holder.keyPair.privateKey,
        overrideKeyPair?.privateKey ?? `${holder.did}#key`,
      ),
    selfSignedJwtVp: (overrideVp) => {
      const selfSignKeyPair = generateKeyPair({ format: 'jwk' });
      return generatePresentationJwt(
        overrideVp ?? vp,
        selfSignKeyPair.privateKey,
      );
    },
  };
};

const expectedAccessToken = (tenant, exchange) => ({
  header: { alg: 'HS384', typ: 'JWT' },
  payload: {
    exp: expect.any(Number),
    iat: expect.any(Number),
    nbf: expect.any(Number),
    scope: [`exchange:${exchange._id}`],
    iss: tenant.did,
    sub: expect.stringMatching(/anonymous|/),
  },
});
const expectedDbExchange = (tenant, relyingPartyService, depot, exchange) => ({
  _id: new ObjectId(exchange._id),
  tenantId: new ObjectId(tenant._id),
  serviceId: new ObjectId(relyingPartyService._id),
  depotId: new ObjectId(depot._id),
  disclosureConsentedAt: expect.any(Date),
  protocolMetadata: {
    protocol: ExchangeProtocols.VN_API,
  },
  type: ExchangeTypes.RELYING_PARTY,
  events: [
    {
      state: 'NEW',
      timestamp: expect.any(Date),
    },
    {
      state: 'PRESENTATION_SUBMISSION_RECEIVED',
      timestamp: expect.any(Date),
    },
  ],
  createdAt: expect.any(Date),
  updatedAt: expect.any(Date),
});
const expectedDbDepot = (tenant, relyingPartyService, depot, overrides = {}) =>
  applyOverrides(
    {
      _id: new ObjectId(depot._id),
      tenantId: new ObjectId(tenant._id),
      serviceId: new ObjectId(relyingPartyService._id),
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    },
    overrides,
  );
const expectedDbPresentation = (tenant, exchange, jwtVp, overrides = {}) =>
  applyOverrides(
    {
      _id: expect.any(ObjectId),
      exchangeId: exchange._id,
      depotId: new ObjectId(exchange.depotId),
      tenantId: new ObjectId(tenant._id),
      format: PresentationFormat.JWT_VP,
      presentation: jwtVp,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    },
    overrides,
  );

const enableNotifications = (eventTypes) => (config) => ({
  ...config,
  notifications: {
    ...config.notifications,
    enabled: true,
    webhook: {
      ...config.notifications.webhook,
      url: 'https://operator.localhost.test/events',
      eventTypes,
      secret: 'test-secret',
    },
  },
});
