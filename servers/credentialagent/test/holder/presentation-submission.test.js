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
const { after, before, beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');

const initVerificationCoupon = mock.fn(() => ({
  getCoupon: () => Promise.resolve(42),
}));
const initRevocationRegistry = mock.fn(() => ({
  getRevokedStatus: () => Promise.resolve(0),
}));
mock.module('@verii/metadata-registration', {
  namedExports: {
    initRevocationRegistry,
    initVerificationCoupon,
  },
});
const mockVerifyCredentials = mock.fn();
mock.module('@verii/verifiable-credentials', {
  namedExports: {
    ...require('@verii/verifiable-credentials'),
    verifyCredentials: mockVerifyCredentials,
  },
});
const mockSendPush = mock.fn(() => Promise.resolve(undefined));
mock.module('../../src/fetchers/push-gateway/push-fetcher.js', {
  namedExports: {
    sendPush: mockSendPush,
  },
});

// eslint-disable-next-line import/order
const buildFastify = require('./helpers/credentialagent-holder-build-fastify');
const { subHours, getUnixTime } = require('date-fns/fp');
const { ObjectId } = require('mongodb');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { mapWithIndex, wait } = require('@verii/common-functions');
const { KeyPurposes, generateKeyPair } = require('@verii/crypto');
const {
  jwtVerify,
  decodeCredentialJwt,
  tamperJwt,
  generateDocJwt,
} = require('@verii/jwt');
const { sampleOrganizationProfile1 } = require('@verii/sample-data');
const { errorResponseMatcher } = require('@verii/tests-helpers');
const { VnfProtocolVersions } = require('@verii/vc-checks');
const { map, isString } = require('lodash/fp');
const { nanoid } = require('nanoid');
const nock = require('nock');
const { getDidUriFromJwk } = require('@verii/did-doc');
const { ISO_DATETIME_FORMAT } = require('@verii/test-regexes');
const { generatePresentation } = require('./helpers/generate-presentation');
const {
  jwtAccessTokenExpectation,
} = require('./helpers/jwt-access-token-expectation');
const {
  initTenantFactory,
  initDisclosureFactory,
  initDisclosureExchangeFactory,
  initKeysFactory,
  initUserFactory,
  initFeedFactory,
  ExchangeProtocols,
  ExchangeStates,
  ExchangeTypes,
  VendorEndpoint,
  NotificationTypes,
} = require('../../src/entities');

describe('presentation submission', () => {
  let fastify;
  let persistDisclosure;
  let persistTenant;
  let persistDisclosureExchange;
  let persistVendorUserIdMapping;
  let tenant;
  let persistKey;
  let persistFeed;
  let disclosure;
  let orgDidDoc;
  let tenantKeyPair;
  let tenantDltKey;
  let vendorUserIdMapping;
  let disclosureExchange;
  let disclosureExchange2;

  const checkResult = {
    credentialChecks: {
      TRUSTED_ISSUER: 'NOT_CHECKED',
      TRUSTED_HOLDER: 'NOT_CHECKED',
      UNEXPIRED: 'NOT_CHECKED',
      UNTAMPERED: 'NOT_CHECKED',
      UNREVOKED: 'NOT_CHECKED',
    },
  };

  const checkResultPaymentRequired = {
    credentialChecks: {
      TRUSTED_HOLDER: 'NOT_CHECKED',
      TRUSTED_ISSUER: 'VOUCHER_RESERVE_EXHAUSTED',
      UNEXPIRED: 'NOT_CHECKED',
      UNTAMPERED: 'NOT_CHECKED',
      UNREVOKED: 'NOT_CHECKED',
    },
  };

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();
    ({ persistDisclosure } = initDisclosureFactory(fastify));
    ({ persistDisclosureExchange } = initDisclosureExchangeFactory(fastify));
    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistKey } = initKeysFactory(fastify));
    ({ persistVendorUserIdMapping } = initUserFactory(fastify));
    ({ persistFeed } = initFeedFactory(fastify));
  });

  beforeEach(async () => {
    mockSendPush.mock.resetCalls();
    mockVerifyCredentials.mock.resetCalls();
    nock.cleanAll();
    fastify.resetOverrides();

    await mongoDb().collection('disclosures').deleteMany({});
    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('keys').deleteMany({});
    await mongoDb().collection('exchanges').deleteMany({});
    await mongoDb().collection('vendorUserIdMappings').deleteMany({});
    await mongoDb().collection('feeds').deleteMany({});

    mockVerifyCredentials.mock.mockImplementation(async ({ credentials }) => {
      return credentials.map((credential) => ({
        credential: decodeCredentialJwt(credential),
        credentialChecks: {
          TRUSTED_HOLDER: 'NOT_CHECKED',
          TRUSTED_ISSUER: 'NOT_CHECKED',
          UNEXPIRED: 'NOT_CHECKED',
          UNTAMPERED: 'NOT_CHECKED',
          UNREVOKED: 'NOT_CHECKED',
        },
      }));
    });
    tenantKeyPair = generateKeyPair({
      format: 'jwk',
    });
    tenant = await persistTenant();
    orgDidDoc = {
      id: tenant.did,
      publicKey: [
        { id: `${tenant.did}#key-1`, publicKeyJwk: tenantKeyPair.publicKey },
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
      keyPair: tenantKeyPair,
    });
    tenantDltKey = await persistKey({
      tenant,
      kidFragment: '#ID1',
      keyPair: tenantKeyPair,
      purposes: [KeyPurposes.DLT_TRANSACTIONS],
    });

    await persistKey({
      tenant,
      kidFragment: '#exchanges-1',
      keyPair: tenantKeyPair,
      purposes: [KeyPurposes.EXCHANGES],
    });
    disclosure = await persistDisclosure({
      tenant,
      vendorEndpoint: VendorEndpoint.RECEIVE_CHECKED_CREDENTIALS,
    });
    vendorUserIdMapping = await persistVendorUserIdMapping({ tenant });

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

    disclosureExchange = await persistDisclosureExchange({
      disclosure,
      tenant,
      protocolMetadata: {
        protocol: ExchangeProtocols.VNF_API,
      },
    });
    disclosureExchange2 = await persistDisclosureExchange({
      disclosure,
      tenant,
      protocolMetadata: {
        protocol: ExchangeProtocols.VNF_API,
      },
    });
  });

  after(async () => {
    await fastify.close();
    nock.cleanAll();
    nock.restore();
    mock.reset();
  });

  const tenantUrl = ({ did }, suffix) => `/api/holder/v0.6/org/${did}${suffix}`;
  const inspectUrl = ({ did }, suffix) =>
    `${tenantUrl({ did }, `/inspect${suffix}`)}`;

  const mockVendorUrl = 'http://mockvendor.localhost.test';
  const sendCredentialsCheckedEndpoint = `/inspection/${VendorEndpoint.RECEIVE_CHECKED_CREDENTIALS}`;
  const sendCredentialsUncheckedEndpoint = `/inspection/${VendorEndpoint.RECEIVE_UNCHECKED_CREDENTIALS}`;
  const sendCredentialsPayload = { body: { numProcessed: 3 } };

  describe('base presentation submission tests', () => {
    it('should 400 if the jwt is invalid', async () => {
      const response = await fastify.injectJson({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        payload: { exchange_id: disclosureExchange._id, jwt_vp: 'BAD JWT' },
      });
      expect(response.statusCode).toEqual(400);
    });
    it('should 400 if the presentation_submission is invalid', async () => {
      // eslint-disable-next-line camelcase
      const presentationBuilder = (
        await generatePresentation(disclosureExchange)
      ).delete('presentation_submission.descriptor_map');
      const response = await fastify.injectJson({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        payload: {
          exchange_id: disclosureExchange._id,
          jwt_vp: await presentationBuilder.selfSign(),
        },
      });

      expect(response.statusCode).toEqual(400);
    });
    it('should 400 if the exchange id mismatched', async () => {
      // eslint-disable-next-line camelcase
      const jwt_vp = await (
        await generatePresentation({
          ...disclosureExchange,
          _id: new ObjectId(),
        })
      ).selfSign();
      const response = await fastify.injectJson({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        // eslint-disable-next-line camelcase
        payload: { exchange_id: disclosureExchange._id, jwt_vp },
      });

      expect(response.statusCode).toEqual(400);
    });
    it('should 400 if the disclosure id mismatched', async () => {
      // eslint-disable-next-line camelcase
      const jwt_vp = await (
        await generatePresentation({
          ...disclosureExchange,
          disclosureId: new ObjectId(),
        })
      ).selfSign();
      const response = await fastify.injectJson({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        // eslint-disable-next-line camelcase
        payload: { exchange_id: disclosureExchange._id, jwt_vp },
      });

      expect(response.statusCode).toEqual(400);
    });
    it('should 400 if the contains an input descriptor isnt a jwt_vc format', async () => {
      const builder = await generatePresentation(disclosureExchange);

      // eslint-disable-next-line camelcase
      const jwt_vp = await builder
        .override({
          presentation_submission: {
            descriptor_map: [
              {
                id: nanoid(),
                path: '$.verifiableCredential[0]',
                format: 'jwt',
              },
              {
                id: nanoid(),
                path: '$.verifiableCredential[1]',
                format: 'jwt',
              },
              {
                id: nanoid(),
                path: '$.verifiableCredential[2]',
                format: 'jwt',
              },
            ],
          },
        })
        .selfSign();
      const response = await fastify.injectJson({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        // eslint-disable-next-line camelcase
        payload: { exchange_id: disclosureExchange._id, jwt_vp },
      });

      expect(response.statusCode).toEqual(400);
    });

    it('should 200 not send notification if the presentation submission with unchecked credentials', async () => {
      const presentationDisclosure = await persistDisclosure({
        tenant,
        sendPushOnVerification: true,
        vendorEndpoint: VendorEndpoint.RECEIVE_UNCHECKED_CREDENTIALS,
      });
      const pushDelegate = {
        pushToken: 'randomToken',
        pushUrl: 'http://secreturl.com',
      };
      const disclosurePresentationExchange = await persistDisclosureExchange({
        disclosure: presentationDisclosure,
        tenant,
        pushDelegate,
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
      });
      const presentationBuilder = await generatePresentation(
        disclosurePresentationExchange
      );
      let webhookPayload;

      nock(mockVendorUrl)
        .post(sendCredentialsUncheckedEndpoint)
        .reply(200, (uri, body) => {
          webhookPayload = body;
          return sendCredentialsPayload;
        });

      const response = await fastify.inject({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        payload: {
          exchange_id: disclosurePresentationExchange._id,
          vp_jwt: await presentationBuilder.selfSign(),
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(mockSendPush.mock.callCount()).toEqual(0);

      expect(response.statusCode).toEqual(200);
      expect(webhookPayload).toEqual({
        exchangeId: disclosurePresentationExchange._id,
        presentationId: presentationBuilder.presentation.id,
        vendorDisclosureId: presentationDisclosure.vendorDisclosureId,
        vendorOrganizationId: tenant.vendorOrganizationId,
        tenantDID: tenant.did,
        tenantId: tenant._id,
        sendPushOnVerification: true,
        rawCredentials: mapWithIndex(
          ({ vc }, i) => ({
            id: vc.id,
            rawCredential:
              presentationBuilder.presentation.verifiableCredential[i],
          }),
          presentationBuilder.credentials
        ),
        credentials: map(
          ({ vc }) => ({
            ...vc,
            issuer: isString(vc.issuer) ? { id: vc.issuer } : vc.issuer,
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          }),
          presentationBuilder.credentials
        ),
      });
    });

    it("should 200 and update feedTimestamp of user's latest feed", async () => {
      const presentationDisclosure = await persistDisclosure({
        tenant,
        sendPushOnVerification: true,
        vendorEndpoint: VendorEndpoint.RECEIVE_UNCHECKED_CREDENTIALS,
        feed: true,
      });
      const leastRecentFeed = await persistFeed({
        tenant,
        disclosure: presentationDisclosure,
        vendorUserId: vendorUserIdMapping.vendorUserId,
      });
      expect(leastRecentFeed.feedTimestamp).toBeUndefined();
      await wait(100);
      const mostRecentFeed = await persistFeed({
        tenant,
        disclosure: presentationDisclosure,
        vendorUserId: vendorUserIdMapping.vendorUserId,
      });
      const pushDelegate = {
        pushToken: 'randomToken',
        pushUrl: 'http://secreturl.com',
      };
      const disclosurePresentationExchange = await persistDisclosureExchange({
        disclosure: presentationDisclosure,
        tenant,
        pushDelegate,
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
      });
      const presentationBuilder = await generatePresentation(
        disclosurePresentationExchange
      );
      let webhookPayload;

      nock(mockVendorUrl)
        .post(sendCredentialsUncheckedEndpoint)
        .reply(200, (uri, body) => {
          webhookPayload = body;
          return sendCredentialsPayload;
        });

      const signedJwt = await generateDocJwt({}, tenantKeyPair.privateKey, {
        kid: '#exchanges-1',
        subject: vendorUserIdMapping._id,
        issuer: tenant.did,
        audience: tenant.did,
        expiresIn: '1h',
      });

      const response = await fastify.inject({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        headers: {
          Authorization: `Bearer ${signedJwt}`,
        },
        payload: {
          exchange_id: disclosurePresentationExchange._id,
          vp_jwt: await presentationBuilder.selfSign(),
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(mockSendPush.mock.callCount()).toEqual(0);

      expect(response.statusCode).toEqual(200);
      expect(webhookPayload).toEqual({
        exchangeId: disclosurePresentationExchange._id,
        presentationId: presentationBuilder.presentation.id,
        vendorDisclosureId: presentationDisclosure.vendorDisclosureId,
        vendorOrganizationId: tenant.vendorOrganizationId,
        tenantDID: tenant.did,
        tenantId: tenant._id,
        sendPushOnVerification: true,
        rawCredentials: mapWithIndex(
          ({ vc }, i) => ({
            id: vc.id,
            rawCredential:
              presentationBuilder.presentation.verifiableCredential[i],
          }),
          presentationBuilder.credentials
        ),
        credentials: map(
          ({ vc }) => ({
            ...vc,
            issuer: isString(vc.issuer) ? { id: vc.issuer } : vc.issuer,
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          }),
          presentationBuilder.credentials
        ),
      });
      const dbLeastRecentFeed = await mongoDb()
        .collection('feeds')
        .findOne({
          _id: new ObjectId(leastRecentFeed._id),
        });
      const dbMostRecentFeed = await mongoDb()
        .collection('feeds')
        .findOne({
          _id: new ObjectId(mostRecentFeed._id),
        });
      expect(dbLeastRecentFeed.feedTimestamp).toBeUndefined();
      expect(dbMostRecentFeed.feedTimestamp).toEqual(expect.any(Date));
    });

    it('should 200 and use custom webhook url from tenant for receive unchecked credential', async () => {
      const webhookUrl = 'https://webhook.com';
      const newTenant = await persistTenant({ webhookUrl });

      const keyPair = generateKeyPair({
        format: 'jwk',
      });
      const newOrgDidDoc = {
        id: newTenant.did,
        publicKey: [
          { id: `${newTenant.did}#key-1`, publicKeyJwk: keyPair.publicKey },
        ],
        service: [
          {
            id: `${newTenant.did}#service-1`,
            type: 'BasicProfileInformation',
            ...sampleOrganizationProfile1,
          },
        ],
      };
      await persistKey({
        tenant: newTenant,
        kidFragment: `#${newOrgDidDoc.publicKey[0].id.split('#')[1]}`,
        keyPair,
      });

      const presentationDisclosure = await persistDisclosure({
        tenant: newTenant,
        vendorEndpoint: VendorEndpoint.RECEIVE_UNCHECKED_CREDENTIALS,
      });
      const disclosurePresentationExchange = await persistDisclosureExchange({
        disclosure: presentationDisclosure,
        tenant: newTenant,
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
      });
      const presentationBuilder = await generatePresentation(
        disclosurePresentationExchange
      );

      const webhookNock = await nock(webhookUrl)
        .post(sendCredentialsUncheckedEndpoint)
        .reply(200);

      const response = await fastify.inject({
        method: 'POST',
        url: inspectUrl(newTenant, '/submit-presentation'),
        payload: {
          exchange_id: disclosurePresentationExchange._id,
          vp_jwt: await presentationBuilder.selfSign(),
        },
      });

      expect(webhookNock.isDone()).toEqual(true);
      expect(response.statusCode).toEqual(200);
    });

    it('should 200 and send notification when receiving a self signed presentation with sendPushOnVerification and pushDelegate', async () => {
      const presentationDisclosure = await persistDisclosure({
        tenant,
        sendPushOnVerification: true,
        vendorEndpoint: VendorEndpoint.RECEIVE_CHECKED_CREDENTIALS,
      });
      const pushDelegate = {
        pushToken: 'randomToken',
        pushUrl: 'http://secreturl.com',
      };
      const disclosurePresentationExchange = await persistDisclosureExchange({
        disclosure: presentationDisclosure,
        tenant,
        pushDelegate,
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
      });
      const presentationBuilder = await generatePresentation(
        disclosurePresentationExchange
      );
      let webhookPayload;

      nock(mockVendorUrl)
        .post(sendCredentialsCheckedEndpoint)
        .reply(200, (uri, body) => {
          webhookPayload = body;
          return sendCredentialsPayload;
        });

      const response = await fastify.inject({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        payload: {
          exchange_id: disclosurePresentationExchange._id,
          vp_jwt: await presentationBuilder.selfSign(),
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(mockSendPush.mock.callCount()).toEqual(1);
      expect(
        mockSendPush.mock.calls.map((call) => call.arguments)
      ).toContainEqual([
        {
          data: {
            exchangeId: expect.any(ObjectId),
            serviceEndpoint: pushDelegate.pushUrl,
            notificationType: NotificationTypes.PRESENTATION_VERIFIFED,
            issuer: tenant.did,
          },
          pushToken: pushDelegate.pushToken,
          id: mockSendPush.mock.calls[0].arguments[0].id,
        },
        pushDelegate,
        expect.any(Object),
      ]);

      expect(response.statusCode).toEqual(200);
      expect(webhookPayload).toEqual({
        exchangeId: disclosurePresentationExchange._id,
        presentationId: presentationBuilder.presentation.id,
        vendorDisclosureId: presentationDisclosure.vendorDisclosureId,
        vendorOrganizationId: tenant.vendorOrganizationId,
        tenantDID: tenant.did,
        tenantId: tenant._id,
        sendPushOnVerification: true,
        paymentRequired: false,
        rawCredentials: mapWithIndex(
          ({ vc }, i) => ({
            id: vc.id,
            rawCredential:
              presentationBuilder.presentation.verifiableCredential[i],
          }),
          presentationBuilder.credentials
        ),
        credentials: map(
          ({ vc }) => ({
            ...vc,
            issuer: isString(vc.issuer) ? { id: vc.issuer } : vc.issuer,
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            ...checkResult,
          }),
          presentationBuilder.credentials
        ),
      });
    });

    it('should 200 and send notification if the did:jwk signed presentation submission', async () => {
      const presentationDisclosure = await persistDisclosure({
        tenant,
        vendorEndpoint: VendorEndpoint.RECEIVE_CHECKED_CREDENTIALS,
      });
      const disclosurePresentationExchange = await persistDisclosureExchange({
        disclosure: presentationDisclosure,
        tenant,
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
      });
      const presentationBuilder = await generatePresentation(
        disclosurePresentationExchange
      );
      let webhookPayload;
      const holderKeyPair = generateKeyPair({ format: 'jwk' });
      const holderDidJwk = getDidUriFromJwk(holderKeyPair.publicKey);
      const holderKid = `${holderDidJwk}#0`;

      const holderSignedPresentation = await presentationBuilder.sign(
        holderKid,
        holderKeyPair.privateKey,
        holderDidJwk
      );
      nock(mockVendorUrl)
        .post(sendCredentialsCheckedEndpoint)
        .reply(200, (uri, body) => {
          webhookPayload = body;
          return sendCredentialsPayload;
        });

      const response = await fastify.inject({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        headers: {
          'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
        }, // actually irrelevant as verifiable-credentials calls are all mocked out
        payload: {
          exchange_id: disclosurePresentationExchange._id,
          vp_jwt: holderSignedPresentation,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(mockSendPush.mock.callCount()).toEqual(0);

      expect(response.statusCode).toEqual(200);
      expect(webhookPayload).toEqual({
        exchangeId: disclosurePresentationExchange._id,
        presentationId: presentationBuilder.presentation.id,
        vendorDisclosureId: presentationDisclosure.vendorDisclosureId,
        tenantDID: tenant.did,
        tenantId: tenant._id,
        sendPushOnVerification: false,
        paymentRequired: false,
        rawCredentials: mapWithIndex(
          ({ vc }, i) => ({
            id: vc.id,
            rawCredential:
              presentationBuilder.presentation.verifiableCredential[i],
          }),
          presentationBuilder.credentials
        ),
        credentials: map(
          ({ vc }) => ({
            ...vc,
            issuer: isString(vc.issuer) ? { id: vc.issuer } : vc.issuer,
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            ...checkResult,
          }),
          presentationBuilder.credentials
        ),
      });

      expect(mockVerifyCredentials.mock.calls[0].arguments).toEqual([
        {
          credentials: expect.any(Array),
          relyingParty: {
            dltOperatorKMSKeyId: new ObjectId(tenantDltKey._id),
          },
          expectedHolderDid: holderDidJwk,
        },
        expect.any(Object),
        expect.any(Object),
      ]);
    });

    it('should 200 and not send notifications if the presentation submission with sendPushOnVerification true and no pushToken', async () => {
      const presentationDisclosure = await persistDisclosure({
        tenant,
        sendPushOnVerification: true,
        vendorEndpoint: VendorEndpoint.RECEIVE_CHECKED_CREDENTIALS,
      });
      const pushDelegate = {
        pushUrl: 'http://secreturl.com',
      };
      const disclosurePresentationExchange = await persistDisclosureExchange({
        disclosure: presentationDisclosure,
        tenant,
        pushDelegate,
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
      });
      const presentationBuilder = await generatePresentation(
        disclosurePresentationExchange
      );
      let webhookPayload;

      nock(mockVendorUrl)
        .post(sendCredentialsCheckedEndpoint)
        .reply(200, (uri, body) => {
          webhookPayload = body;
          return sendCredentialsPayload;
        });

      const response = await fastify.inject({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        payload: {
          exchange_id: disclosurePresentationExchange._id,
          vp_jwt: await presentationBuilder.selfSign(),
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(mockSendPush.mock.callCount()).toEqual(0);

      expect(webhookPayload).toEqual({
        exchangeId: disclosurePresentationExchange._id,
        presentationId: presentationBuilder.presentation.id,
        vendorDisclosureId: presentationDisclosure.vendorDisclosureId,
        vendorOrganizationId: tenant.vendorOrganizationId,
        tenantDID: tenant.did,
        tenantId: tenant._id,
        paymentRequired: false,
        sendPushOnVerification: true,
        rawCredentials: mapWithIndex(
          ({ vc }, i) => ({
            id: vc.id,
            rawCredential:
              presentationBuilder.presentation.verifiableCredential[i],
          }),
          presentationBuilder.credentials
        ),
        credentials: map(
          ({ vc }) => ({
            ...vc,
            issuer: isString(vc.issuer) ? { id: vc.issuer } : vc.issuer,
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            ...checkResult,
          }),
          presentationBuilder.credentials
        ),
      });
    });

    it('should 200 and not send notifications if the presentation submission with sendPushOnVerification true and no pushUrl', async () => {
      const presentationDisclosure = await persistDisclosure({
        tenant,
        sendPushOnVerification: true,
        vendorEndpoint: VendorEndpoint.RECEIVE_CHECKED_CREDENTIALS,
      });
      const pushDelegate = {
        pushToken: 'token',
      };
      const disclosurePresentationExchange = await persistDisclosureExchange({
        disclosure: presentationDisclosure,
        tenant,
        pushDelegate,
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
      });
      const presentationBuilder = await generatePresentation(
        disclosurePresentationExchange
      );
      let webhookPayload;

      nock(mockVendorUrl)
        .post(sendCredentialsCheckedEndpoint)
        .reply(200, (uri, body) => {
          webhookPayload = body;
          return sendCredentialsPayload;
        });

      const response = await fastify.inject({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        payload: {
          exchange_id: disclosurePresentationExchange._id,
          vp_jwt: await presentationBuilder.selfSign(),
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(mockSendPush.mock.callCount()).toEqual(0);

      expect(webhookPayload).toEqual({
        exchangeId: disclosurePresentationExchange._id,
        presentationId: presentationBuilder.presentation.id,
        vendorDisclosureId: presentationDisclosure.vendorDisclosureId,
        vendorOrganizationId: tenant.vendorOrganizationId,
        paymentRequired: false,
        tenantDID: tenant.did,
        tenantId: tenant._id,
        sendPushOnVerification: true,
        rawCredentials: mapWithIndex(
          ({ vc }, i) => ({
            id: vc.id,
            rawCredential:
              presentationBuilder.presentation.verifiableCredential[i],
          }),
          presentationBuilder.credentials
        ),
        credentials: map(
          ({ vc }) => ({
            ...vc,
            issuer: isString(vc.issuer) ? { id: vc.issuer } : vc.issuer,
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            ...checkResult,
          }),
          presentationBuilder.credentials
        ),
      });
    });

    it('should 200 and use custom webhook url from tenant for receive checked credential', async () => {
      const webhookUrl = 'https://webhook.com';
      const newTenant = await persistTenant({ webhookUrl });

      const keyPair = generateKeyPair({
        format: 'jwk',
      });

      orgDidDoc = {
        id: newTenant.did,
        publicKey: [
          { id: `${newTenant.did}#key-1`, publicKeyJwk: keyPair.publicKey },
        ],
        service: [
          {
            id: `${newTenant.did}#service-1`,
            type: 'BasicProfileInformation',
            ...sampleOrganizationProfile1,
          },
        ],
      };
      await persistKey({
        tenant: newTenant,
        kidFragment: `#${orgDidDoc.publicKey[0].id.split('#')[1]}`,
        keyPair,
      });

      const presentationDisclosure = await persistDisclosure({
        tenant: newTenant,
        vendorEndpoint: VendorEndpoint.RECEIVE_CHECKED_CREDENTIALS,
      });
      const disclosurePresentationExchange = await persistDisclosureExchange({
        disclosure: presentationDisclosure,
        tenant: newTenant,
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
      });
      const presentationBuilder = await generatePresentation(
        disclosurePresentationExchange
      );

      const nockWebhook = await nock(webhookUrl)
        .post(sendCredentialsCheckedEndpoint)
        .reply(200);

      const response = await fastify.inject({
        method: 'POST',
        url: inspectUrl(newTenant, '/submit-presentation'),
        payload: {
          exchange_id: disclosurePresentationExchange._id,
          vp_jwt: await presentationBuilder.selfSign(),
        },
      });

      expect(nockWebhook.isDone()).toEqual(true);
      expect(response.statusCode).toEqual(200);
    });

    it('should 400 if the input descriptor path doesnt dereference anything', async () => {
      const builder = await generatePresentation(disclosureExchange);

      // eslint-disable-next-line camelcase
      const jwt_vp = await builder
        .override({
          presentation_submission: {
            descriptor_map: [
              {
                id: nanoid(),
                path: '$.verifiableCredential[0]',
                format: 'jwt_vc',
              },
              {
                id: nanoid(),
                path: '$.verifiableCredential[1]',
                format: 'jwt_vc',
              },
              {
                id: nanoid(),
                path: '$.verifiableCredential[4]',
                format: 'jwt_vc',
              },
            ],
          },
        })
        .selfSign();
      const response = await fastify.injectJson({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        // eslint-disable-next-line camelcase
        payload: { exchange_id: disclosureExchange._id, jwt_vp },
      });

      expect(response.statusCode).toEqual(400);
    });

    it('should 400 id disclosure deactivated', async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        enableDeactivatedDisclosure: true,
      });
      disclosure = await persistDisclosure({
        tenant,
        deactivationDate: '2000-12-01T00:00:00.000Z',
        vendorEndpoint: VendorEndpoint.RECEIVE_CHECKED_CREDENTIALS,
      });
      disclosureExchange = await persistDisclosureExchange({
        disclosure,
        tenant,
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
      });
      const presentationBuilder = await generatePresentation(
        disclosureExchange
      );
      const response = await fastify.injectJson({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        payload: {
          exchange_id: disclosureExchange._id,
          jwt_vp: await presentationBuilder.selfSign(),
        },
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

    it('should 200 if the presentation submission maps to a standard vp', async () => {
      const presentationBuilder = await generatePresentation(
        disclosureExchange
      );
      let webhookPayload;

      nock(mockVendorUrl)
        .post(sendCredentialsCheckedEndpoint)
        .reply(200, (uri, body) => {
          webhookPayload = body;
          return sendCredentialsPayload;
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        payload: {
          exchange_id: disclosureExchange._id,
          jwt_vp: await presentationBuilder.selfSign(),
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        exchange: {
          id: disclosureExchange._id,
          type: ExchangeTypes.DISCLOSURE,
          disclosureComplete: true,
          exchangeComplete: true,
        },
        token: expect.any(String),
      });

      expect(
        await jwtVerify(response.json.token, tenantKeyPair.publicKey)
      ).toEqual(
        jwtAccessTokenExpectation(tenant, null, {
          jti: disclosureExchange._id.toString(),
          sub: expect.stringMatching(/anonymous|/),
        })
      );
      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(disclosureExchange._id) });
      expect(dbExchange).toEqual({
        ...disclosureExchange,
        _id: new ObjectId(disclosureExchange._id),
        tenantId: new ObjectId(tenant._id),
        disclosureId: new ObjectId(disclosure._id),
        events: [
          { state: ExchangeStates.NEW, timestamp: expect.any(Date) },
          {
            state: ExchangeStates.DISCLOSURE_RECEIVED,
            timestamp: expect.any(Date),
          },
          {
            state: ExchangeStates.DISCLOSURE_CHECKED,
            timestamp: expect.any(Date),
          },
          {
            state: ExchangeStates.COMPLETE,
            timestamp: expect.any(Date),
          },
        ],
        presentationId: presentationBuilder.presentation.id,
        disclosureConsentedAt: expect.any(Date),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(webhookPayload).toEqual({
        exchangeId: disclosureExchange._id,
        presentationId: presentationBuilder.presentation.id,
        vendorDisclosureId: disclosure.vendorDisclosureId,
        vendorOrganizationId: tenant.vendorOrganizationId,
        tenantDID: tenant.did,
        tenantId: tenant._id,
        paymentRequired: false,
        sendPushOnVerification: false,
        rawCredentials: mapWithIndex(
          ({ vc }, i) => ({
            id: vc.id,
            rawCredential:
              presentationBuilder.presentation.verifiableCredential[i],
          }),
          presentationBuilder.credentials
        ),
        credentials: map(
          ({ vc }) => ({
            ...vc,
            issuer: isString(vc.issuer) ? { id: vc.issuer } : vc.issuer,
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            ...checkResult,
          }),
          presentationBuilder.credentials
        ),
      });
    });

    it('123 should 200 and add to jwt token expiration date based on authTokensExpireIn', async () => {
      const { insertedId } = await mongoDb()
        .collection('disclosures')
        .insertOne({
          description: 'Clerk',
          types: [
            { type: 'PastEmploymentPosition' },
            { type: 'CurrentEmploymentPosition' },
          ],
          vendorEndpoint: VendorEndpoint.RECEIVE_CHECKED_CREDENTIALS,
          tenantId: new ObjectId(tenant._id),
          vendorDisclosureId: 'HR-PKG-USPS-CLRK',
          purpose: 'Job Application',
          duration: '6y',
          termsUrl: 'https://www.lipsum.com/feed/html',
          sendPushOnVerification: false,
          authTokensExpireIn: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      disclosure = await mongoDb()
        .collection('disclosures')
        .findOne({ _id: insertedId });
      disclosureExchange = await persistDisclosureExchange({
        disclosure,
        tenant,
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
      });
      const presentationBuilder = await generatePresentation(
        disclosureExchange
      );
      const dbDisclosureBeforeRequest = await mongoDb()
        .collection('disclosures')
        .findOne({
          _id: new ObjectId(disclosureExchange.disclosureId.toString()),
        });
      expect(dbDisclosureBeforeRequest.configurationType).toBeUndefined();

      nock(mockVendorUrl)
        .post(sendCredentialsCheckedEndpoint)
        .reply(200, () => {
          return sendCredentialsPayload;
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        payload: {
          exchange_id: disclosureExchange._id,
          jwt_vp: await presentationBuilder.selfSign(),
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        exchange: {
          id: disclosureExchange._id,
          type: ExchangeTypes.DISCLOSURE,
          disclosureComplete: true,
          exchangeComplete: true,
        },
        token: expect.any(String),
      });

      expect(
        await jwtVerify(response.json.token, tenantKeyPair.publicKey)
      ).toEqual(
        jwtAccessTokenExpectation(tenant, null, {
          jti: disclosureExchange._id.toString(),
          sub: expect.stringMatching(/anonymous|/),
        })
      );
      const dbDisclosureAfterRequest = await mongoDb()
        .collection('disclosures')
        .findOne({
          _id: new ObjectId(disclosureExchange.disclosureId.toString()),
        });

      expect(dbDisclosureAfterRequest.configurationType).toEqual('inspection');
      // jest.useRealTimers();
    });

    it('should 200 and set configuration type to disclosure', async () => {
      const { insertedId } = await mongoDb()
        .collection('disclosures')
        .insertOne({
          description: 'Clerk',
          types: [
            { type: 'PastEmploymentPosition' },
            { type: 'CurrentEmploymentPosition' },
          ],
          vendorEndpoint: VendorEndpoint.RECEIVE_CHECKED_CREDENTIALS,
          tenantId: new ObjectId(tenant._id),
          vendorDisclosureId: 'HR-PKG-USPS-CLRK',
          purpose: 'Job Application',
          duration: '6y',
          termsUrl: 'https://www.lipsum.com/feed/html',
          sendPushOnVerification: false,
          authTokensExpireIn: 10080,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      disclosure = await mongoDb()
        .collection('disclosures')
        .findOne({ _id: insertedId });
      disclosureExchange = await persistDisclosureExchange({
        disclosure,
        tenant,
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
      });
      const presentationBuilder = await generatePresentation(
        disclosureExchange
      );
      const dbDisclosureBeforeRequest = await mongoDb()
        .collection('disclosures')
        .findOne({
          _id: new ObjectId(disclosureExchange.disclosureId.toString()),
        });
      expect(dbDisclosureBeforeRequest.configurationType).toBeUndefined();

      nock(mockVendorUrl)
        .post(sendCredentialsCheckedEndpoint)
        .reply(200, () => {
          return sendCredentialsPayload;
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        payload: {
          exchange_id: disclosureExchange._id,
          jwt_vp: await presentationBuilder.selfSign(),
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        exchange: {
          id: disclosureExchange._id,
          type: ExchangeTypes.DISCLOSURE,
          disclosureComplete: true,
          exchangeComplete: true,
        },
        token: expect.any(String),
      });

      expect(
        await jwtVerify(response.json.token, tenantKeyPair.publicKey)
      ).toEqual(
        jwtAccessTokenExpectation(tenant, null, {
          jti: disclosureExchange._id.toString(),
          sub: expect.stringMatching(/anonymous|/),
        })
      );

      const dbDisclosureAfterRequest = await mongoDb()
        .collection('disclosures')
        .findOne({
          _id: new ObjectId(disclosureExchange.disclosureId.toString()),
        });

      expect(dbDisclosureAfterRequest.configurationType).toEqual('inspection');
    });

    it('should 200 with credentials status payment required', async () => {
      mockVerifyCredentials.mock.mockImplementationOnce(
        async ({ credentials }) => {
          return credentials.map((credential) => ({
            credential: decodeCredentialJwt(credential),
            credentialChecks: {
              TRUSTED_HOLDER: 'NOT_CHECKED',
              TRUSTED_ISSUER: 'VOUCHER_RESERVE_EXHAUSTED',
              UNEXPIRED: 'NOT_CHECKED',
              UNTAMPERED: 'NOT_CHECKED',
              UNREVOKED: 'NOT_CHECKED',
            },
          }));
        }
      );
      const presentationBuilder = await generatePresentation(
        disclosureExchange
      );
      let webhookPayload;

      nock(mockVendorUrl)
        .post(sendCredentialsCheckedEndpoint)
        .reply(200, (uri, body) => {
          webhookPayload = body;
          return sendCredentialsPayload;
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        payload: {
          exchange_id: disclosureExchange._id,
          jwt_vp: await presentationBuilder.selfSign(),
        },
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        exchange: {
          id: disclosureExchange._id,
          type: ExchangeTypes.DISCLOSURE,
          disclosureComplete: true,
          exchangeComplete: true,
        },
        token: expect.any(String),
      });

      expect(
        await jwtVerify(response.json.token, tenantKeyPair.publicKey)
      ).toEqual(
        jwtAccessTokenExpectation(tenant, null, {
          jti: disclosureExchange._id.toString(),
          sub: expect.stringMatching(/anonymous|/),
        })
      );

      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(disclosureExchange._id) });
      expect(dbExchange).toEqual({
        ...disclosureExchange,
        _id: new ObjectId(disclosureExchange._id),
        tenantId: new ObjectId(tenant._id),
        disclosureId: new ObjectId(disclosure._id),
        events: [
          { state: ExchangeStates.NEW, timestamp: expect.any(Date) },
          {
            state: ExchangeStates.DISCLOSURE_RECEIVED,
            timestamp: expect.any(Date),
          },
          {
            state: ExchangeStates.DISCLOSURE_CHECKED,
            timestamp: expect.any(Date),
          },
          {
            state: ExchangeStates.COMPLETE,
            timestamp: expect.any(Date),
          },
        ],
        presentationId: presentationBuilder.presentation.id,
        disclosureConsentedAt: expect.any(Date),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(webhookPayload).toEqual({
        exchangeId: disclosureExchange._id,
        presentationId: presentationBuilder.presentation.id,
        vendorDisclosureId: disclosure.vendorDisclosureId,
        vendorOrganizationId: tenant.vendorOrganizationId,
        sendPushOnVerification: false,
        paymentRequired: true,
        tenantDID: tenant.did,
        tenantId: tenant._id,
        rawCredentials: mapWithIndex(
          ({ vc }, i) => ({
            id: vc.id,
            rawCredential:
              presentationBuilder.presentation.verifiableCredential[i],
          }),
          presentationBuilder.credentials
        ),
        credentials: map(
          ({ vc }) => ({
            ...vc,
            issuer: isString(vc.issuer) ? { id: vc.issuer } : vc.issuer,
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            ...checkResultPaymentRequired,
          }),
          presentationBuilder.credentials
        ),
      });
    });

    it('should 200 with credentials UNTAMPERED be VOUCHER_RESERVE_EXHAUSTED status payment required true', async () => {
      const credentialChecks = {
        TRUSTED_HOLDER: 'NOT_CHECKED',
        TRUSTED_ISSUER: 'NOT_CHECKED',
        UNEXPIRED: 'NOT_CHECKED',
        UNTAMPERED: 'VOUCHER_RESERVE_EXHAUSTED',
        UNREVOKED: 'NOT_CHECKED',
      };

      mockVerifyCredentials.mock.mockImplementationOnce(
        async ({ credentials }) => {
          return credentials.map((credential) => ({
            credential: decodeCredentialJwt(credential),
            credentialChecks,
          }));
        }
      );
      const presentationBuilder = await generatePresentation(
        disclosureExchange
      );
      let webhookPayload;

      nock(mockVendorUrl)
        .post(sendCredentialsCheckedEndpoint)
        .reply(200, (uri, body) => {
          webhookPayload = body;
          return sendCredentialsPayload;
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        payload: {
          exchange_id: disclosureExchange._id,
          jwt_vp: await presentationBuilder.selfSign(),
        },
      });
      expect(response.statusCode).toEqual(200);

      expect(webhookPayload).toEqual({
        exchangeId: disclosureExchange._id,
        presentationId: presentationBuilder.presentation.id,
        vendorDisclosureId: disclosure.vendorDisclosureId,
        vendorOrganizationId: tenant.vendorOrganizationId,
        sendPushOnVerification: false,
        paymentRequired: true,
        tenantDID: tenant.did,
        tenantId: tenant._id,
        rawCredentials: mapWithIndex(
          ({ vc }, i) => ({
            id: vc.id,
            rawCredential:
              presentationBuilder.presentation.verifiableCredential[i],
          }),
          presentationBuilder.credentials
        ),
        credentials: map(
          ({ vc }) => ({
            ...vc,
            issuer: isString(vc.issuer) ? { id: vc.issuer } : vc.issuer,
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            credentialChecks,
          }),
          presentationBuilder.credentials
        ),
      });
    });

    it('should 200 with credentials UNTAMPERED be NOT_CHECKED status payment required false', async () => {
      const credentialChecks = {
        TRUSTED_HOLDER: 'NOT_CHECKED',
        TRUSTED_ISSUER: 'NOT_CHECKED',
        UNEXPIRED: 'NOT_CHECKED',
        UNTAMPERED: 'NOT_CHECKED',
        UNREVOKED: 'NOT_CHECKED',
      };

      mockVerifyCredentials.mock.mockImplementationOnce(
        async ({ credentials }) => {
          return credentials.map((credential) => ({
            credential: decodeCredentialJwt(credential),
            credentialChecks,
          }));
        }
      );
      const presentationBuilder = await generatePresentation(
        disclosureExchange
      );
      let webhookPayload;

      nock(mockVendorUrl)
        .post(sendCredentialsCheckedEndpoint)
        .reply(200, (uri, body) => {
          webhookPayload = body;
          return sendCredentialsPayload;
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        payload: {
          exchange_id: disclosureExchange._id,
          jwt_vp: await presentationBuilder.selfSign(),
        },
      });
      expect(response.statusCode).toEqual(200);

      expect(webhookPayload).toEqual({
        exchangeId: disclosureExchange._id,
        presentationId: presentationBuilder.presentation.id,
        vendorDisclosureId: disclosure.vendorDisclosureId,
        vendorOrganizationId: tenant.vendorOrganizationId,
        sendPushOnVerification: false,
        paymentRequired: false,
        tenantDID: tenant.did,
        tenantId: tenant._id,
        rawCredentials: mapWithIndex(
          ({ vc }, i) => ({
            id: vc.id,
            rawCredential:
              presentationBuilder.presentation.verifiableCredential[i],
          }),
          presentationBuilder.credentials
        ),
        credentials: map(
          ({ vc }) => ({
            ...vc,
            issuer: isString(vc.issuer) ? { id: vc.issuer } : vc.issuer,
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            credentialChecks,
          }),
          presentationBuilder.credentials
        ),
      });
    });

    it('should be backwards compatible with the vp_jwt prop', async () => {
      const presentationBuilder = await generatePresentation(
        disclosureExchange
      );
      let webhookPayload;

      nock(mockVendorUrl)
        .post(sendCredentialsCheckedEndpoint)
        .reply(200, (uri, body) => {
          webhookPayload = body;
          return sendCredentialsPayload;
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        payload: {
          exchange_id: disclosureExchange._id,
          vp_jwt: await presentationBuilder.selfSign(),
        },
      });

      expect(response.statusCode).toEqual(200);
      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(disclosureExchange._id) });
      expect(dbExchange).toEqual({
        ...disclosureExchange,
        _id: new ObjectId(disclosureExchange._id),
        tenantId: new ObjectId(tenant._id),
        disclosureId: new ObjectId(disclosure._id),
        events: [
          { state: ExchangeStates.NEW, timestamp: expect.any(Date) },
          {
            state: ExchangeStates.DISCLOSURE_RECEIVED,
            timestamp: expect.any(Date),
          },
          {
            state: ExchangeStates.DISCLOSURE_CHECKED,
            timestamp: expect.any(Date),
          },
          {
            state: ExchangeStates.COMPLETE,
            timestamp: expect.any(Date),
          },
        ],
        presentationId: presentationBuilder.presentation.id,
        disclosureConsentedAt: expect.any(Date),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(webhookPayload).toEqual({
        exchangeId: disclosureExchange._id,
        presentationId: presentationBuilder.presentation.id,
        vendorDisclosureId: disclosure.vendorDisclosureId,
        vendorOrganizationId: tenant.vendorOrganizationId,
        tenantDID: tenant.did,
        tenantId: tenant._id,
        sendPushOnVerification: false,
        paymentRequired: false,
        rawCredentials: mapWithIndex(
          ({ vc }, i) => ({
            id: vc.id,
            rawCredential:
              presentationBuilder.presentation.verifiableCredential[i],
          }),
          presentationBuilder.credentials
        ),
        credentials: map(
          ({ vc }) => ({
            ...vc,
            issuer: isString(vc.issuer) ? { id: vc.issuer } : vc.issuer,
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            ...checkResult,
          }),
          presentationBuilder.credentials
        ),
      });
    });
    it('should 409 if the presentation submission has already occurred', async () => {
      const nockContext = nock(mockVendorUrl)
        .post(sendCredentialsCheckedEndpoint)
        .times(2)
        .reply(200, sendCredentialsPayload);

      const presentationBuilder = await generatePresentation(
        disclosureExchange
      );

      const selfSignedPresentation = await presentationBuilder.selfSign();
      const responses = await Promise.all([
        fastify.injectJson({
          method: 'POST',
          url: inspectUrl(tenant, '/submit-presentation'),
          payload: {
            exchange_id: disclosureExchange._id,
            jwt_vp: selfSignedPresentation,
          },
        }),
        fastify.injectJson({
          method: 'POST',
          url: inspectUrl(tenant, '/submit-presentation'),
          payload: {
            exchange_id: disclosureExchange._id,
            jwt_vp: selfSignedPresentation,
          },
        }),
      ]);

      expect(map('statusCode', responses)).toEqual(
        expect.arrayContaining([200, 409])
      );

      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(disclosureExchange._id) });
      expect(dbExchange).toEqual({
        ...disclosureExchange,
        _id: new ObjectId(disclosureExchange._id),
        tenantId: new ObjectId(tenant._id),
        disclosureId: new ObjectId(disclosure._id),
        events: [
          { state: ExchangeStates.NEW, timestamp: expect.any(Date) },
          {
            state: ExchangeStates.DISCLOSURE_RECEIVED,
            timestamp: expect.any(Date),
          },
          {
            state: ExchangeStates.DISCLOSURE_CHECKED,
            timestamp: expect.any(Date),
          },
          {
            state: ExchangeStates.COMPLETE,
            timestamp: expect.any(Date),
          },
        ],
        presentationId: presentationBuilder.presentation.id,
        disclosureConsentedAt: expect.any(Date),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(nockContext.pendingMocks()).toHaveLength(1);
    });
    it('should 200 on 2 different presentation submissions', async () => {
      const nockContext = nock(mockVendorUrl)
        .post(sendCredentialsCheckedEndpoint)
        .times(2)
        .reply(200, sendCredentialsPayload);

      const presentationBuilder = await generatePresentation(
        disclosureExchange
      );
      const presentationBuilder2 = await generatePresentation(
        disclosureExchange2
      );
      const response = await fastify.injectJson({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        payload: {
          exchange_id: disclosureExchange._id,
          jwt_vp: await presentationBuilder.selfSign(),
        },
      });

      const response2 = await fastify.injectJson({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        payload: {
          exchange_id: disclosureExchange2._id,
          jwt_vp: await presentationBuilder2.selfSign(),
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response2.statusCode).toEqual(200);

      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(disclosureExchange._id) });
      expect(dbExchange).toEqual({
        ...disclosureExchange,
        _id: new ObjectId(disclosureExchange._id),
        tenantId: new ObjectId(tenant._id),
        disclosureId: new ObjectId(disclosure._id),
        events: [
          { state: ExchangeStates.NEW, timestamp: expect.any(Date) },
          {
            state: ExchangeStates.DISCLOSURE_RECEIVED,
            timestamp: expect.any(Date),
          },
          {
            state: ExchangeStates.DISCLOSURE_CHECKED,
            timestamp: expect.any(Date),
          },
          {
            state: ExchangeStates.COMPLETE,
            timestamp: expect.any(Date),
          },
        ],
        presentationId: presentationBuilder.presentation.id,
        disclosureConsentedAt: expect.any(Date),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      const dbExchange2 = await mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(disclosureExchange2._id) });
      expect(dbExchange2).toEqual({
        ...disclosureExchange,
        _id: new ObjectId(disclosureExchange2._id),
        tenantId: new ObjectId(tenant._id),
        disclosureId: new ObjectId(disclosure._id),
        events: [
          { state: ExchangeStates.NEW, timestamp: expect.any(Date) },
          {
            state: ExchangeStates.DISCLOSURE_RECEIVED,
            timestamp: expect.any(Date),
          },
          {
            state: ExchangeStates.DISCLOSURE_CHECKED,
            timestamp: expect.any(Date),
          },
          {
            state: ExchangeStates.COMPLETE,
            timestamp: expect.any(Date),
          },
        ],
        presentationId: presentationBuilder2.presentation.id,
        disclosureConsentedAt: expect.any(Date),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(nockContext.pendingMocks()).toHaveLength(0);
    });
    it('should 200 if the presentation submission maps to a standard vp and contains a vendorOriginContext', async () => {
      const presentationBuilder = await generatePresentation(
        disclosureExchange
      );
      presentationBuilder.presentation.vendorOriginContext = '123';

      let webhookPayload;
      nock(mockVendorUrl)
        .post(sendCredentialsCheckedEndpoint)
        .reply(200, (uri, body) => {
          webhookPayload = body;
          return sendCredentialsPayload;
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        payload: {
          exchange_id: disclosureExchange._id,
          jwt_vp: await presentationBuilder.selfSign(),
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        exchange: {
          id: disclosureExchange._id,
          type: 'DISCLOSURE',
          disclosureComplete: true,
          exchangeComplete: true,
        },
        token: expect.any(String),
      });

      expect(
        await jwtVerify(response.json.token, tenantKeyPair.publicKey)
      ).toEqual(
        jwtAccessTokenExpectation(tenant, null, {
          jti: disclosureExchange._id.toString(),
          sub: expect.stringMatching(/anonymous|/),
        })
      );

      const dbExchange = await mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(disclosureExchange._id) });
      expect(dbExchange).toEqual({
        ...disclosureExchange,
        _id: new ObjectId(disclosureExchange._id),
        tenantId: new ObjectId(tenant._id),
        disclosureId: new ObjectId(disclosure._id),
        events: [
          { state: ExchangeStates.NEW, timestamp: expect.any(Date) },
          {
            state: ExchangeStates.DISCLOSURE_RECEIVED,
            timestamp: expect.any(Date),
          },
          {
            state: ExchangeStates.DISCLOSURE_CHECKED,
            timestamp: expect.any(Date),
          },
          {
            state: ExchangeStates.COMPLETE,
            timestamp: expect.any(Date),
          },
        ],
        presentationId: presentationBuilder.presentation.id,
        disclosureConsentedAt: expect.any(Date),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(webhookPayload).toEqual({
        exchangeId: disclosureExchange._id,
        presentationId: presentationBuilder.presentation.id,
        vendorDisclosureId: disclosure.vendorDisclosureId,
        vendorOrganizationId: tenant.vendorOrganizationId,
        tenantDID: tenant.did,
        tenantId: tenant._id,
        sendPushOnVerification: false,
        paymentRequired: false,
        vendorOriginContext: '123',
        rawCredentials: mapWithIndex(
          ({ vc }, i) => ({
            id: vc.id,
            rawCredential:
              presentationBuilder.presentation.verifiableCredential[i],
          }),
          presentationBuilder.credentials
        ),
        credentials: map(
          ({ vc }) => ({
            ...vc,
            issuer: isString(vc.issuer) ? { id: vc.issuer } : vc.issuer,
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            ...checkResult,
          }),
          presentationBuilder.credentials
        ),
      });
    });
  });

  describe('presentation @context validation enabled test suite', () => {
    beforeEach(async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        enablePresentationContextValidation: true,
      });
    });

    it('should 400 when @context is a string and is incorrect value', async () => {
      const presentationDocument = (
        await generatePresentation(disclosureExchange)
      ).override({ '@context': 'foo' });

      const response = await fastify.injectJson({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        payload: {
          exchange_id: disclosureExchange._id,
          jwt_vp: await presentationDocument.selfSign(),
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          message: 'presentation @context is not set correctly',
          statusCode: 400,
          errorCode: 'presentation_invalid',
        })
      );
    });
    it('should 400 when @context is an array and is incorrect value', async () => {
      const presentationDocument = (
        await generatePresentation(disclosureExchange)
      ).override({ '@context': ['foo'] });

      const response = await fastify.injectJson({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        payload: {
          exchange_id: disclosureExchange._id,
          jwt_vp: await presentationDocument.selfSign(),
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          message: 'presentation @context is not set correctly',
          statusCode: 400,
          errorCode: 'presentation_invalid',
        })
      );
    });
    it('should 400 when @context is an empty array', async () => {
      const presentationDocument = (
        await generatePresentation(disclosureExchange)
      ).override({ '@context': [] });

      const response = await fastify.injectJson({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        payload: {
          exchange_id: disclosureExchange._id,
          jwt_vp: await presentationDocument.selfSign(),
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          message: 'presentation @context is not set correctly',
          statusCode: 400,
          errorCode: 'presentation_invalid',
        })
      );
    });
    it('should 200 when @context is a string and is correct value', async () => {
      const presentationBuilder = (
        await generatePresentation(disclosureExchange)
      ).override({
        '@context': 'https://www.w3.org/2018/credentials/v1',
      });

      nock(mockVendorUrl)
        .post(sendCredentialsCheckedEndpoint)
        .reply(200, sendCredentialsPayload);

      const response = await fastify.injectJson({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        payload: {
          exchange_id: disclosureExchange._id,
          jwt_vp: await presentationBuilder.selfSign(),
        },
      });

      expect(response.statusCode).toEqual(200);
    });
    it('should 200 when @context is an array and is correct value', async () => {
      const presentationBuilder = (
        await generatePresentation(disclosureExchange)
      ).override({
        '@context': ['https://www.w3.org/2018/credentials/v1'],
      });

      nock(mockVendorUrl)
        .post(sendCredentialsCheckedEndpoint)
        .reply(200, sendCredentialsPayload);

      const response = await fastify.injectJson({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        payload: {
          exchange_id: disclosureExchange._id,
          jwt_vp: await presentationBuilder.selfSign(),
        },
      });

      expect(response.statusCode).toEqual(200);
    });
  });

  describe('presentation submission authorization test suite', () => {
    it('should 401 if the disclosure feed is true, but no auth token', async () => {
      disclosure = await persistDisclosure({
        tenant,
        vendorEndpoint: VendorEndpoint.RECEIVE_CHECKED_CREDENTIALS,
        feed: true,
      });
      disclosureExchange = await persistDisclosureExchange({
        disclosure,
        tenant,
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
      });
      const builder = await generatePresentation(disclosureExchange);

      // eslint-disable-next-line camelcase
      const jwt_vp = await builder.selfSign();
      const response = await fastify.injectJson({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        // eslint-disable-next-line camelcase
        payload: { exchange_id: disclosureExchange._id, jwt_vp },
      });

      expect(response.statusCode).toEqual(401);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Unauthorized',
          errorCode: 'unauthorized',
          message: 'Unauthorized',
          statusCode: 401,
        })
      );
    });
    it('should 401 if user is not found', async () => {
      disclosure = await persistDisclosure({
        tenant,
        vendorEndpoint: VendorEndpoint.RECEIVE_CHECKED_CREDENTIALS,
        feed: true,
      });
      disclosureExchange = await persistDisclosureExchange({
        disclosure,
        tenant,
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
      });

      const signedJwt = await generateDocJwt(
        { foo: 'foo' },
        tenantKeyPair.privateKey,
        {
          subject: 'foo',
          issuer: 'did:foo:foo',
          audience: 'did:foo:foo',
          expiresIn: '1h',
        }
      );
      const builder = await generatePresentation(disclosureExchange);

      // eslint-disable-next-line camelcase
      const jwt_vp = await builder.selfSign();
      const response = await fastify.injectJson({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        headers: {
          Authorization: `Bearer ${signedJwt}`,
        },
        // eslint-disable-next-line camelcase
        payload: { exchange_id: disclosureExchange._id, jwt_vp },
      });

      expect(response.statusCode).toEqual(401);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Unauthorized',
          errorCode: 'unauthorized',
          message: 'Unauthorized',
          statusCode: 401,
        })
      );
    });
    it('should 401 if auth jwt is tampered', async () => {
      disclosure = await persistDisclosure({
        tenant,
        vendorEndpoint: VendorEndpoint.RECEIVE_CHECKED_CREDENTIALS,
        feed: true,
      });
      disclosureExchange = await persistDisclosureExchange({
        disclosure,
        tenant,
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
      });

      const signedJwt = await generateDocJwt(
        { foo: 'foo' },
        tenantKeyPair.privateKey,
        {
          subject: vendorUserIdMapping._id,
          issuer: 'did:foo:foo',
          audience: 'did:foo:foo',
          expiresIn: '1h',
        }
      );
      const tamperedJwt = tamperJwt(signedJwt, { foo: 'bar' });
      const builder = await generatePresentation(disclosureExchange);

      // eslint-disable-next-line camelcase
      const jwt_vp = await builder.selfSign();
      const response = await fastify.injectJson({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        headers: {
          Authorization: `Bearer ${tamperedJwt}`,
        },
        // eslint-disable-next-line camelcase
        payload: { exchange_id: disclosureExchange._id, jwt_vp },
      });

      expect(response.statusCode).toEqual(401);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Unauthorized',
          errorCode: 'unauthorized',
          message: 'Unauthorized',
          statusCode: 401,
        })
      );
    });
    it('should 401 if auth jwt is expired', async () => {
      disclosure = await persistDisclosure({
        tenant,
        vendorEndpoint: VendorEndpoint.RECEIVE_CHECKED_CREDENTIALS,
        feed: true,
      });
      disclosureExchange = await persistDisclosureExchange({
        disclosure,
        tenant,
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
      });

      const signedJwt = await generateDocJwt(
        { foo: 'foo' },
        tenantKeyPair.privateKey,
        {
          kid: `${tenant.did}#key-1`,
          subject: vendorUserIdMapping._id,
          issuer: tenant.did,
          audience: tenant.did,
          exp: getUnixTime(subHours(1)(new Date())),
        }
      );
      const builder = await generatePresentation(disclosureExchange);

      // eslint-disable-next-line camelcase
      const jwt_vp = await builder.selfSign();
      const response = await fastify.injectJson({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        headers: {
          Authorization: `Bearer ${signedJwt}`,
        },
        // eslint-disable-next-line camelcase
        payload: { exchange_id: disclosureExchange._id, jwt_vp },
      });

      expect(response.statusCode).toEqual(401);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Unauthorized',
          errorCode: 'unauthorized',
          message: 'Unauthorized',
          statusCode: 401,
        })
      );
    });
    it('should 401 if auth jwt audience is not the tenant', async () => {
      disclosure = await persistDisclosure({
        tenant,
        vendorEndpoint: VendorEndpoint.RECEIVE_CHECKED_CREDENTIALS,
        feed: true,
      });
      disclosureExchange = await persistDisclosureExchange({
        disclosure,
        tenant,
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
      });

      const signedJwt = await generateDocJwt(
        { foo: 'foo' },
        tenantKeyPair.privateKey,
        {
          subject: vendorUserIdMapping._id,
          issuer: tenant.did,
          audience: 'did:foo:foo',
          expiresIn: '1h',
        }
      );
      const builder = await generatePresentation(disclosureExchange);

      // eslint-disable-next-line camelcase
      const jwt_vp = await builder.selfSign();
      const response = await fastify.injectJson({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        headers: {
          Authorization: `Bearer ${signedJwt}`,
        },
        // eslint-disable-next-line camelcase
        payload: { exchange_id: disclosureExchange._id, jwt_vp },
      });

      expect(response.statusCode).toEqual(401);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Unauthorized',
          errorCode: 'unauthorized',
          message: 'Unauthorized',
          statusCode: 401,
        })
      );
    });
    it('should 401 if auth jwt issuer is not the tenant', async () => {
      disclosure = await persistDisclosure({
        tenant,
        vendorEndpoint: VendorEndpoint.RECEIVE_CHECKED_CREDENTIALS,
        feed: true,
      });
      disclosureExchange = await persistDisclosureExchange({
        disclosure,
        tenant,
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
      });

      const signedJwt = await generateDocJwt(
        { foo: 'foo' },
        tenantKeyPair.privateKey,
        {
          subject: vendorUserIdMapping._id,
          issuer: 'did:foo:foo',
          audience: tenant.did,
          expiresIn: '1h',
        }
      );
      const builder = await generatePresentation(disclosureExchange);

      // eslint-disable-next-line camelcase
      const jwt_vp = await builder.selfSign();
      const response = await fastify.injectJson({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        headers: {
          Authorization: `Bearer ${signedJwt}`,
        },
        // eslint-disable-next-line camelcase
        payload: { exchange_id: disclosureExchange._id, jwt_vp },
      });

      expect(response.statusCode).toEqual(401);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Unauthorized',
          errorCode: 'unauthorized',
          message: 'Unauthorized',
          statusCode: 401,
        })
      );
    });
    it('should 200 if auth jwt is valid', async () => {
      const vendorNock = nock(mockVendorUrl);

      disclosure = await persistDisclosure({
        tenant,
        vendorEndpoint: VendorEndpoint.RECEIVE_UNCHECKED_CREDENTIALS,
        feed: true,
      });
      disclosureExchange = await persistDisclosureExchange({
        disclosure,
        tenant,
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
      });

      vendorNock.post(sendCredentialsUncheckedEndpoint).reply(200);

      const signedJwt = await generateDocJwt(
        { foo: 'foo' },
        tenantKeyPair.privateKey,
        {
          kid: '#exchanges-1',
          subject: vendorUserIdMapping._id,
          issuer: tenant.did,
          audience: tenant.did,
          expiresIn: '1h',
        }
      );
      const builder = await generatePresentation(disclosureExchange);

      // eslint-disable-next-line camelcase
      const jwt_vp = await builder.selfSign();
      const response = await fastify.injectJson({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        headers: {
          Authorization: `Bearer ${signedJwt}`,
        },
        // eslint-disable-next-line camelcase
        payload: { exchange_id: disclosureExchange._id, jwt_vp },
      });

      expect(response.statusCode).toEqual(200);
      expect(vendorNock.isDone()).toEqual(true);
    });
    it('should 200 if disclosure.field is false', async () => {
      const vendorNock = nock(mockVendorUrl);

      disclosure = await persistDisclosure({
        tenant,
        vendorEndpoint: VendorEndpoint.RECEIVE_UNCHECKED_CREDENTIALS,
        feed: false,
      });
      disclosureExchange = await persistDisclosureExchange({
        disclosure,
        tenant,
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
      });

      vendorNock.post(sendCredentialsUncheckedEndpoint).reply(200);

      const builder = await generatePresentation(disclosureExchange);

      // eslint-disable-next-line camelcase
      const jwt_vp = await builder.selfSign();
      const response = await fastify.injectJson({
        method: 'POST',
        url: inspectUrl(tenant, '/submit-presentation'),
        headers: {},
        // eslint-disable-next-line camelcase
        payload: { exchange_id: disclosureExchange._id, jwt_vp },
      });

      expect(response.statusCode).toEqual(200);
      expect(vendorNock.isDone()).toEqual(true);
    });
  });
});
