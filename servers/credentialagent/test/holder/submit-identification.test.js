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

// eslint-disable-next-line import/order
const buildFastify = require('./helpers/credentialagent-holder-build-fastify');
const { generateKeyPair } = require('@verii/crypto');
const { VnfProtocolVersions } = require('@verii/vc-checks');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { ObjectId } = require('mongodb');
const { decodeJwt } = require('jose');
const { map, omitBy } = require('lodash/fp');
const nock = require('nock');
const { ISO_DATETIME_FORMAT } = require('@verii/test-regexes');
const { mongoify, errorResponseMatcher } = require('@verii/tests-helpers');
const metadataRegistration = require('@verii/metadata-registration');

const DEFAULT_CREDENTIAL_CHECKS = {
  TRUSTED_HOLDER: 'PASS',
  TRUSTED_ISSUER: 'PASS',
  UNEXPIRED: 'PASS',
  UNTAMPERED: 'PASS',
  UNREVOKED: 'PASS',
};

jest.mock('@verii/metadata-registration');

const mockVerifyCredentials = jest.fn();
jest.mock('@verii/verifiable-credentials', () => ({
  ...jest.requireActual('@verii/verifiable-credentials'),
  verifyCredentials: (...args) => mockVerifyCredentials(...args),
}));

const { CredentialCheckResultValue } = require('@verii/verifiable-credentials');
const { getDidUriFromJwk } = require('@verii/did-doc');
const { holderConfig } = require('../../src/config/holder-config');
const {
  initTenantFactory,
  initKeysFactory,
  initUserFactory,
  initOfferExchangeFactory,
  initDisclosureFactory,
  ExchangeStates,
  ExchangeTypes,
  VendorEndpoint,
} = require('../../src/entities');
const {
  generateKYCPresentation,
  emailPayload,
  phonePayload,
  idDocPayload,
  legacyIdDocPayload,
  verificationIdentifierPayload,
} = require('./helpers/generate-presentation');

const setMockVerifyCredentials = (checkResults = DEFAULT_CREDENTIAL_CHECKS) => {
  const { decodeCredentialJwt } = require('@verii/jwt');
  // mockVerifyCredentials.reset();
  mockVerifyCredentials.mockImplementation(async ({ credentials }) =>
    Promise.resolve(
      credentials.map((credential) => ({
        credential: decodeCredentialJwt(credential),
        credentialChecks: checkResults,
      }))
    )
  );
};

const credentialTypesObject = { credentialTypes: ['PastEmploymentPosition'] };

describe('submit identification disclosure', () => {
  let fastify;
  let tenant;
  let persistOfferExchange;
  let persistTenant;
  let persistKey;
  let persistDisclosure;
  let newVendorUserIdMapping;
  let persistVendorUserIdMapping;

  let holderKeys;
  let holderDid;
  let holderKid;

  const idUrl = ({ did }) =>
    `/api/holder/v0.6/org/${did}/issue/submit-identification`;

  const mockVendorUrl = 'http://mockvendor.localhost.test';

  const identifyUserOnVendorEndpoint = '/issuing/identify';

  beforeAll(async () => {
    fastify = buildFastify(holderConfig);
    await fastify.ready();
    ({ persistOfferExchange } = initOfferExchangeFactory(fastify));
    ({ persistTenant } = initTenantFactory(fastify));
    ({ persistKey } = initKeysFactory(fastify));
    ({ newVendorUserIdMapping, persistVendorUserIdMapping } =
      initUserFactory(fastify));
    ({ persistDisclosure } = initDisclosureFactory(fastify));
  });

  beforeEach(async () => {
    fastify.resetOverrides();
    nock.cleanAll();
    jest.resetAllMocks();
    setMockVerifyCredentials();

    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('vendorUserIdMappings').deleteMany({});
    await mongoDb().collection('exchanges').deleteMany({});
    await mongoDb().collection('disclosures').deleteMany({});
    tenant = await persistTenant();
    const keyPair = generateKeyPair({ format: 'jwk' });
    await persistKey({
      tenant,
      kidFragment: '#ID1',
      keyPair,
    });

    holderKeys = generateKeyPair({ format: 'jwk' });
    holderDid = getDidUriFromJwk(holderKeys.publicKey);
    holderKid = `${holderDid}#0`;

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

    metadataRegistration.initVerificationCoupon.mockImplementation(() => ({
      getCoupon: () => Promise.resolve(42),
    }));
    metadataRegistration.initRevocationRegistry.mockImplementation(() => ({
      getRevokedStatus: () => Promise.resolve(0),
    }));
  });

  afterAll(async () => {
    await fastify.close();
    nock.cleanAll();
    nock.restore();
  });

  describe('using integrated identification', () => {
    it('should fail if the json path doesnt exist', async () => {
      const disclosure = await persistDisclosure({
        tenant,
        description: 'Credential Issuance disclosure',
        types: [{ type: 'EmailV1.0' }],
        vendorEndpoint: VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION,
        purpose: 'Identification',
        duration: '6y',
        identityMatchers: {
          rules: [
            {
              valueIndex: 0, // used for identifying the value
              path: ['$.doesntexist'], // jsonPath within the credential
              rule: 'pick', // Rule to execute can be pick, all (if the target is an array), equal (if the target is a singleValue)
            },
          ],
          vendorUserIdIndex: 0,
        },
      });
      const exchange = await persistOfferExchange({
        tenant,
        disclosure,
        identityMatcherValues: ['adam.smith@example.com'],
      });

      const presentationEmail = await generateKYCPresentation(
        exchange,
        'email'
      );

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        payload: {
          jwt_vp: await presentationEmail.selfSign(),
          exchange_id: exchange._id,
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          message: 'Presentation doesnt contain value at $.doesntexist',
          statusCode: 400,
          errorCode: 'presentation_credential_jsonpath_empty',
        })
      );

      const exchangeDBResult = await mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(exchange._id) });
      expect(exchangeDBResult).toEqual(
        mongoify({
          ...exchange,
          tenantId: tenant._id,
          presentationId: presentationEmail.presentation.id,
          disclosureConsentedAt: expect.any(Date),
          err: 'Presentation doesnt contain value at $.doesntexist',
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
              state: ExchangeStates.UNEXPECTED_ERROR,
              timestamp: expect.any(Date),
            },
          ],
          offerHashes: [],
          ...credentialTypesObject,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
    });

    it('should error if rule isnt "all", "pick" or "equal"', async () => {
      const disclosure = await persistDisclosure({
        tenant,
        description: 'Credential Issuance disclosure',
        types: [{ type: 'EmailV1.0' }],
        vendorEndpoint: VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION,
        purpose: 'Identification',
        duration: '6y',
        identityMatchers: {
          rules: [
            {
              valueIndex: 0, // used for identifying the value
              path: ['$.emails'], // jsonPath within the credential
              rule: 'notARule', // Rule to execute can be pick, all (if the target is an array), equal (if the target is a singleValue)
            },
          ],
          vendorUserIdIndex: 0,
        },
      });

      const exchange = await persistOfferExchange({
        tenant,
        disclosure,
        identityMatcherValues: ['adam.smith@example.com'],
      });

      const presentationEmail = await generateKYCPresentation(
        exchange,
        'email'
      );

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        payload: {
          jwt_vp: await presentationEmail.selfSign(),
          exchange_id: exchange._id,
        },
      });
      expect(response.statusCode).toEqual(500);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Internal Server Error',
          message:
            'Credential Agent only supports "pick" or "all" for "identityMatchers.rule"',
          statusCode: 500,
          errorCode: 'missing_error_code',
        })
      );
    });

    describe('"pick" rule matching using email', () => {
      let disclosure;

      beforeEach(async () => {
        disclosure = await persistDisclosure({
          tenant,
          description: 'Credential Issuance disclosure',
          types: [{ type: 'EmailV1.0' }],
          vendorEndpoint: VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION,
          purpose: 'Identification',
          duration: '6y',
          identityMatchers: {
            rules: [
              {
                valueIndex: 0, // used for identifying the value
                path: ['$.emails'], // jsonPath within the credential
                rule: 'pick', // Rule to execute can be pick, all (if the target is an array), equal (if the target is a singleValue)
              },
            ],
            vendorUserIdIndex: 0,
          },
        });
      });

      it('email based matching should match an existent user', async () => {
        const exchange = await persistOfferExchange({
          tenant,
          disclosure,
          identityMatcherValues: ['Adam.smith@example.com'],
        });
        const vendorUserId = exchange.identityMatcherValues[0];

        const presentationEmail = await generateKYCPresentation(
          exchange,
          'email'
        );

        const response = await fastify.injectJson({
          method: 'POST',
          url: idUrl(tenant),
          payload: {
            jwt_vp: await presentationEmail.selfSign(),
            exchange_id: exchange._id,
          },
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          token: expect.any(String),
          exchange: {
            disclosureComplete: true,
            exchangeComplete: false,
            id: exchange._id,
            type: ExchangeTypes.ISSUING,
          },
        });

        const dbResult = await mongoDb()
          .collection('vendorUserIdMappings')
          .findOne({ vendorUserId });
        const { sub } = decodeJwt(response.json.token);
        expect(dbResult).toEqual({
          _id: new ObjectId(sub),
          vendorUserId,
          tenantId: new ObjectId(tenant._id),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
        const exchangeDBResult = await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) });
        expect(exchangeDBResult).toEqual(
          mongoify({
            ...exchange,
            tenantId: tenant._id,
            presentationId: presentationEmail.presentation.id,
            disclosureConsentedAt: expect.any(Date),
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
              { state: ExchangeStates.IDENTIFIED, timestamp: expect.any(Date) },
            ],
            offerHashes: [],
            ...credentialTypesObject,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          })
        );
      });

      it('email based matching should succeed if holder check is NOT_APPLICABLE', async () => {
        setMockVerifyCredentials({
          ...DEFAULT_CREDENTIAL_CHECKS,
          TRUSTED_HOLDER: CredentialCheckResultValue.NOT_APPLICABLE,
        });
        const exchange = await persistOfferExchange({
          tenant,
          disclosure,
          identityMatcherValues: ['Adam.smith@example.com'],
        });
        const vendorUserId = exchange.identityMatcherValues[0];

        const presentationEmail = await generateKYCPresentation(
          exchange,
          'email'
        );

        const response = await fastify.injectJson({
          method: 'POST',
          url: idUrl(tenant),
          payload: {
            jwt_vp: await presentationEmail.selfSign(),
            exchange_id: exchange._id,
          },
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          token: expect.any(String),
          exchange: {
            disclosureComplete: true,
            exchangeComplete: false,
            id: exchange._id,
            type: ExchangeTypes.ISSUING,
          },
        });

        const dbResult = await mongoDb()
          .collection('vendorUserIdMappings')
          .findOne({ vendorUserId });
        const { sub } = decodeJwt(response.json.token);
        expect(dbResult).toEqual({
          _id: new ObjectId(sub),
          vendorUserId,
          tenantId: new ObjectId(tenant._id),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
        const exchangeDBResult = await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) });
        expect(exchangeDBResult).toEqual(
          mongoify({
            ...exchange,
            tenantId: tenant._id,
            presentationId: presentationEmail.presentation.id,
            disclosureConsentedAt: expect.any(Date),
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
              { state: ExchangeStates.IDENTIFIED, timestamp: expect.any(Date) },
            ],
            offerHashes: [],
            ...credentialTypesObject,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          })
        );
      });

      it('email based matching should 401 if user not found', async () => {
        const exchange = await persistOfferExchange({
          tenant,
          disclosure,
          identityMatcherValues: ['adam.nomatch@example.com'],
        });

        const presentationEmail = await generateKYCPresentation(
          exchange,
          'email'
        );

        const response = await fastify.injectJson({
          method: 'POST',
          url: idUrl(tenant),
          payload: {
            jwt_vp: await presentationEmail.selfSign(),
            exchange_id: exchange._id,
          },
        });
        expect(response.statusCode).toEqual(401);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Unauthorized',
            errorCode: 'integrated_identification_user_not_found',
            message: 'User Not Found',
            statusCode: 401,
          })
        );

        const exchangeDBResult = await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) });
        expect(exchangeDBResult).toEqual(
          mongoify({
            ...exchange,
            tenantId: tenant._id,
            presentationId: presentationEmail.presentation.id,
            disclosureConsentedAt: expect.any(Date),
            err: 'User Not Found',
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
                state: ExchangeStates.NOT_IDENTIFIED,
                timestamp: expect.any(Date),
              },
            ],
            offerHashes: [],
            ...credentialTypesObject,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          })
        );
      });

      it('email based matching should 401 if credential tampered', async () => {
        setMockVerifyCredentials({
          ...DEFAULT_CREDENTIAL_CHECKS,
          UNTAMPERED: CredentialCheckResultValue.FAIL,
        });
        const exchange = await persistOfferExchange({
          tenant,
          disclosure,
          identityMatcherValues: ['adam.smith@example.com'],
        });

        const presentationEmail = await generateKYCPresentation(
          exchange,
          'email'
        );

        const response = await fastify.injectJson({
          method: 'POST',
          url: idUrl(tenant),
          payload: {
            jwt_vp: await presentationEmail.selfSign(),
            exchange_id: exchange._id,
          },
        });
        expect(response.statusCode).toEqual(401);

        const exchangeDBResult = await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) });
        expect(exchangeDBResult).toEqual(
          mongoify({
            ...exchange,
            tenantId: tenant._id,
            presentationId: presentationEmail.presentation.id,
            disclosureConsentedAt: expect.any(Date),
            err: 'presentation_credential_tampered',
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
                state: ExchangeStates.NOT_IDENTIFIED,
                timestamp: expect.any(Date),
              },
            ],
            offerHashes: [],
            ...credentialTypesObject,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          })
        );
      });

      it('email based matching should 401 if credential not from a trusted issuer', async () => {
        setMockVerifyCredentials({
          ...DEFAULT_CREDENTIAL_CHECKS,
          TRUSTED_ISSUER: CredentialCheckResultValue.FAIL,
        });
        const exchange = await persistOfferExchange({
          tenant,
          disclosure,
          identityMatcherValues: ['adam.smith@example.com'],
        });

        const presentationEmail = await generateKYCPresentation(
          exchange,
          'email'
        );

        const response = await fastify.injectJson({
          method: 'POST',
          url: idUrl(tenant),
          payload: {
            jwt_vp: await presentationEmail.selfSign(),
            exchange_id: exchange._id,
          },
        });
        expect(response.statusCode).toEqual(401);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Unauthorized',
            errorCode: 'presentation_credential_bad_issuer',
            message: 'presentation_credential_bad_issuer',
            statusCode: 401,
          })
        );

        const exchangeDBResult = await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) });
        expect(exchangeDBResult).toEqual(
          mongoify({
            ...exchange,
            tenantId: tenant._id,
            presentationId: presentationEmail.presentation.id,
            disclosureConsentedAt: expect.any(Date),
            err: 'presentation_credential_bad_issuer',
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
                state: ExchangeStates.NOT_IDENTIFIED,
                timestamp: expect.any(Date),
              },
            ],
            offerHashes: [],
            ...credentialTypesObject,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          })
        );
      });

      it('email based matching should 401 if credential not from a trusted holder', async () => {
        setMockVerifyCredentials({
          ...DEFAULT_CREDENTIAL_CHECKS,
          TRUSTED_HOLDER: CredentialCheckResultValue.FAIL,
        });
        const exchange = await persistOfferExchange({
          tenant,
          disclosure,
          identityMatcherValues: ['adam.smith@example.com'],
        });

        const presentationEmail = await generateKYCPresentation(
          exchange,
          'email'
        );

        const response = await fastify.injectJson({
          method: 'POST',
          url: idUrl(tenant),
          payload: {
            jwt_vp: await presentationEmail.selfSign(),
            exchange_id: exchange._id,
          },
        });
        expect(response.statusCode).toEqual(401);

        const exchangeDBResult = await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) });
        expect(exchangeDBResult).toEqual(
          mongoify({
            ...exchange,
            tenantId: tenant._id,
            presentationId: presentationEmail.presentation.id,
            disclosureConsentedAt: expect.any(Date),
            err: 'presentation_credential_bad_holder',
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
                state: ExchangeStates.NOT_IDENTIFIED,
                timestamp: expect.any(Date),
              },
            ],
            offerHashes: [],
            ...credentialTypesObject,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          })
        );
      });

      it('email based matching should 401 if credential revoked', async () => {
        setMockVerifyCredentials({
          ...DEFAULT_CREDENTIAL_CHECKS,
          UNREVOKED: CredentialCheckResultValue.FAIL,
        });
        const exchange = await persistOfferExchange({
          tenant,
          disclosure,
          identityMatcherValues: ['adam.smith@example.com'],
        });

        const presentationEmail = await generateKYCPresentation(
          exchange,
          'email'
        );

        const response = await fastify.injectJson({
          method: 'POST',
          url: idUrl(tenant),
          payload: {
            jwt_vp: await presentationEmail.selfSign(),
            exchange_id: exchange._id,
          },
        });
        expect(response.statusCode).toEqual(401);

        const exchangeDBResult = await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) });
        expect(exchangeDBResult).toEqual(
          mongoify({
            ...exchange,
            tenantId: tenant._id,
            presentationId: presentationEmail.presentation.id,
            disclosureConsentedAt: expect.any(Date),
            err: 'presentation_credential_revoked',
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
                state: ExchangeStates.NOT_IDENTIFIED,
                timestamp: expect.any(Date),
              },
            ],
            offerHashes: [],
            ...credentialTypesObject,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          })
        );
      });

      it('email based matching should 401 if credential expired', async () => {
        setMockVerifyCredentials({
          ...DEFAULT_CREDENTIAL_CHECKS,
          UNEXPIRED: CredentialCheckResultValue.FAIL,
        });
        const exchange = await persistOfferExchange({
          tenant,
          disclosure,
          identityMatcherValues: ['adam.smith@example.com'],
        });

        const presentationEmail = await generateKYCPresentation(
          exchange,
          'email'
        );

        const response = await fastify.injectJson({
          method: 'POST',
          url: idUrl(tenant),
          payload: {
            jwt_vp: await presentationEmail.selfSign(),
            exchange_id: exchange._id,
          },
        });
        expect(response.statusCode).toEqual(401);

        const exchangeDBResult = await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) });
        expect(exchangeDBResult).toEqual(
          mongoify({
            ...exchange,
            tenantId: tenant._id,
            presentationId: presentationEmail.presentation.id,
            disclosureConsentedAt: expect.any(Date),
            err: 'presentation_credential_expired',
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
                state: ExchangeStates.NOT_IDENTIFIED,
                timestamp: expect.any(Date),
              },
            ],
            offerHashes: [],
            ...credentialTypesObject,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          })
        );
      });

      it('email based matching should match an existent user on second try', async () => {
        const exchange = await persistOfferExchange({
          tenant,
          disclosure,
          identityMatcherValues: ['adam.smith@example.com'],
          events: [
            { state: ExchangeStates.NEW, timestamp: new Date() },
            {
              state: ExchangeStates.DISCLOSURE_RECEIVED,
              timestamp: new Date(),
            },
            {
              state: ExchangeStates.DISCLOSURE_CHECKED,
              timestamp: new Date(),
            },
            {
              state: ExchangeStates.NOT_IDENTIFIED,
              timestamp: new Date(),
            },
          ],
        });
        const vendorUserId = exchange.identityMatcherValues[0];

        const presentationEmail = await generateKYCPresentation(
          exchange,
          'email'
        );

        const response = await fastify.injectJson({
          method: 'POST',
          url: idUrl(tenant),
          payload: {
            jwt_vp: await presentationEmail.selfSign(),
            exchange_id: exchange._id,
          },
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          token: expect.any(String),
          exchange: {
            disclosureComplete: true,
            exchangeComplete: false,
            id: exchange._id,
            type: ExchangeTypes.ISSUING,
          },
        });

        const dbResult = await mongoDb()
          .collection('vendorUserIdMappings')
          .findOne({ vendorUserId });
        const { sub } = decodeJwt(response.json.token);
        expect(dbResult).toEqual({
          _id: new ObjectId(sub),
          vendorUserId,
          tenantId: new ObjectId(tenant._id),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
        const exchangeDBResult = await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) });
        expect(exchangeDBResult).toEqual(
          mongoify({
            ...exchange,
            tenantId: tenant._id,
            presentationId: presentationEmail.presentation.id,
            disclosureConsentedAt: expect.any(Date),
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
                state: ExchangeStates.NOT_IDENTIFIED,
                timestamp: expect.any(Date),
              },
              {
                state: ExchangeStates.DISCLOSURE_RECEIVED,
                timestamp: expect.any(Date),
              },
              {
                state: ExchangeStates.DISCLOSURE_CHECKED,
                timestamp: expect.any(Date),
              },
              { state: ExchangeStates.IDENTIFIED, timestamp: expect.any(Date) },
            ],
            offerHashes: [],
            ...credentialTypesObject,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          })
        );
      });
    });

    describe('"pick" rule matching using id credential', () => {
      let disclosure;

      beforeEach(async () => {
        disclosure = await persistDisclosure({
          tenant,
          description: 'Credential Issuance disclosure',
          types: [{ type: 'DriversLicenseV1.0' }],
          vendorEndpoint: VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION,
          purpose: 'Identification',
          duration: '6y',
          identityMatchers: {
            rules: [
              {
                valueIndex: 0, // used for identifying the value
                path: [
                  '$.idDocumentCredentials[*].credentialSubject.identifier',
                ], // jsonPath within the credential
                rule: 'pick', // Rule to execute can be pick, all (if the target is an array), equal (if the target is a singleValue)
              },
            ],
            vendorUserIdIndex: 0,
          },
        });
      });

      it('identifier based matching should match an existent user', async () => {
        const exchange = await persistOfferExchange({
          tenant,
          disclosure,
          identityMatcherValues: ['2200221100'],
        });
        const vendorUserId = exchange.identityMatcherValues[0];

        const presentationEmail = await generateKYCPresentation(
          exchange,
          'driversLicense'
        );

        const response = await fastify.injectJson({
          method: 'POST',
          url: idUrl(tenant),
          payload: {
            jwt_vp: await presentationEmail.selfSign(),
            exchange_id: exchange._id,
          },
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          token: expect.any(String),
          exchange: {
            disclosureComplete: true,
            exchangeComplete: false,
            id: exchange._id,
            type: ExchangeTypes.ISSUING,
          },
        });

        const dbResult = await mongoDb()
          .collection('vendorUserIdMappings')
          .findOne({ vendorUserId });
        const { sub } = decodeJwt(response.json.token);
        expect(dbResult).toEqual({
          _id: new ObjectId(sub),
          vendorUserId,
          tenantId: new ObjectId(tenant._id),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
        const exchangeDBResult = await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) });
        expect(exchangeDBResult).toEqual(
          mongoify({
            ...exchange,
            tenantId: tenant._id,
            presentationId: presentationEmail.presentation.id,
            disclosureConsentedAt: expect.any(Date),
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
              { state: ExchangeStates.IDENTIFIED, timestamp: expect.any(Date) },
            ],
            offerHashes: [],
            ...credentialTypesObject,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          })
        );
      });
      it('identifier based matching should 401 if user not found', async () => {
        const exchange = await persistOfferExchange({
          tenant,
          disclosure,
          identityMatcherValues: ['foo'],
        });

        const presentationEmail = await generateKYCPresentation(
          exchange,
          'driversLicense'
        );

        const response = await fastify.injectJson({
          method: 'POST',
          url: idUrl(tenant),
          payload: {
            jwt_vp: await presentationEmail.selfSign(),
            exchange_id: exchange._id,
          },
        });
        expect(response.statusCode).toEqual(401);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Unauthorized',
            errorCode: 'integrated_identification_user_not_found',
            message: 'User Not Found',
            statusCode: 401,
          })
        );

        const exchangeDBResult = await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) });
        expect(exchangeDBResult).toEqual(
          mongoify({
            ...exchange,
            tenantId: tenant._id,
            presentationId: presentationEmail.presentation.id,
            disclosureConsentedAt: expect.any(Date),
            err: 'User Not Found',
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
                state: ExchangeStates.NOT_IDENTIFIED,
                timestamp: expect.any(Date),
              },
            ],
            offerHashes: [],
            ...credentialTypesObject,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          })
        );
      });
    });

    describe('"all" rule for givenName matching', () => {
      let disclosure;
      let exchange;
      let vendorUserId;

      beforeEach(async () => {
        disclosure = await persistDisclosure({
          tenant,
          description: 'Credential Issuance disclosure',
          types: [{ type: 'EmailV1.0' }],
          vendorEndpoint: VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION,
          purpose: 'Identification',
          duration: '6y',
          identityMatchers: {
            rules: [
              {
                valueIndex: 0, // used for identifying the value
                path: [
                  '$.idDocumentCredentials[*].credentialSubject.person.givenName',
                ], // jsonPath within the credential
                rule: 'all', // Rule to execute can be pick, all (if the target is an array), equal (if the target is a singleValue)
              },
            ],
            vendorUserIdIndex: 0,
          },
        });
        exchange = await persistOfferExchange({
          tenant,
          disclosure,
          identityMatcherValues: ['sam'],
        });
        vendorUserId = exchange.identityMatcherValues[0];
      });

      it('given name matching should 200 if user found', async () => {
        const presentationEmail = await generateKYCPresentation(
          exchange,
          'idDocument'
        );

        const response = await fastify.injectJson({
          method: 'POST',
          url: idUrl(tenant),
          headers: {
            'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
          },
          payload: {
            jwt_vp: await presentationEmail.sign(
              holderKid,
              holderKeys.privateKey,
              holderDid
            ),
            exchange_id: exchange._id,
          },
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          token: expect.any(String),
          exchange: {
            disclosureComplete: true,
            exchangeComplete: false,
            id: exchange._id,
            type: ExchangeTypes.ISSUING,
          },
        });

        const dbResult = await mongoDb()
          .collection('vendorUserIdMappings')
          .findOne({ vendorUserId });
        const { sub } = decodeJwt(response.json.token);
        expect(dbResult).toEqual({
          _id: new ObjectId(sub),
          vendorUserId,
          tenantId: new ObjectId(tenant._id),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
        const exchangeDBResult = await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) });
        expect(exchangeDBResult).toEqual(
          mongoify({
            ...exchange,
            tenantId: tenant._id,
            presentationId: presentationEmail.presentation.id,
            disclosureConsentedAt: expect.any(Date),
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
              { state: ExchangeStates.IDENTIFIED, timestamp: expect.any(Date) },
            ],
            offerHashes: [],
            ...credentialTypesObject,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          })
        );
      });
      it('given name matching on all docs should 200 if user found', async () => {
        const presentationEmail = await generateKYCPresentation(exchange, [
          'idDocument',
          'driversLicense',
        ]);

        const response = await fastify.injectJson({
          method: 'POST',
          url: idUrl(tenant),
          headers: {
            'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
          },
          payload: {
            jwt_vp: await presentationEmail.sign(
              holderKid,
              holderKeys.privateKey,
              holderDid
            ),
            exchange_id: exchange._id,
          },
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          token: expect.any(String),
          exchange: {
            disclosureComplete: true,
            exchangeComplete: false,
            id: exchange._id,
            type: ExchangeTypes.ISSUING,
          },
        });

        const dbResult = await mongoDb()
          .collection('vendorUserIdMappings')
          .findOne({ vendorUserId });
        const { sub } = decodeJwt(response.json.token);
        expect(dbResult).toEqual({
          _id: new ObjectId(sub),
          vendorUserId,
          tenantId: new ObjectId(tenant._id),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
        const exchangeDBResult = await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) });
        expect(exchangeDBResult).toEqual(
          mongoify({
            ...exchange,
            tenantId: tenant._id,
            presentationId: presentationEmail.presentation.id,
            disclosureConsentedAt: expect.any(Date),
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
              { state: ExchangeStates.IDENTIFIED, timestamp: expect.any(Date) },
            ],
            offerHashes: [],
            ...credentialTypesObject,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          })
        );
      });
      it('given name matching should 401 if user not found', async () => {
        const noMatchExchange = await persistOfferExchange({
          tenant,
          disclosure,
          identityMatcherValues: ['NotMatchingName'],
        });

        const presentationEmail = await generateKYCPresentation(
          noMatchExchange,
          'idDocument'
        );

        const response = await fastify.injectJson({
          method: 'POST',
          headers: {
            'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
          },
          url: idUrl(tenant),
          payload: {
            jwt_vp: await presentationEmail.sign(
              holderKid,
              holderKeys.privateKey,
              holderDid
            ),
            exchange_id: noMatchExchange._id,
          },
        });
        expect(response.statusCode).toEqual(401);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Unauthorized',
            errorCode: 'integrated_identification_user_not_found',
            message: 'User Not Found',
            statusCode: 401,
          })
        );

        const exchangeDBResult = await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(noMatchExchange._id) });
        expect(exchangeDBResult).toEqual(
          mongoify({
            ...noMatchExchange,
            tenantId: tenant._id,
            presentationId: presentationEmail.presentation.id,
            disclosureConsentedAt: expect.any(Date),
            err: 'User Not Found',
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
                state: ExchangeStates.NOT_IDENTIFIED,
                timestamp: expect.any(Date),
              },
            ],
            offerHashes: [],
            ...credentialTypesObject,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          })
        );
      });
    });

    describe('associated exchanges test suite', () => {
      it('should error if rule isnt "all", "pick" or "equal"', async () => {
        const disclosure = await persistDisclosure({
          tenant,
          description: 'Credential Issuance disclosure',
          types: [{ type: 'EmailV1.0' }],
          vendorEndpoint: VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION,
          purpose: 'Identification',
          duration: '6y',
          identityMatchers: {
            rules: [
              {
                valueIndex: 0, // used for identifying the value
                path: ['$.emails'], // jsonPath within the credential
                rule: 'notARule', // Rule to execute can be pick, all (if the target is an array), equal (if the target is a singleValue)
              },
            ],
            vendorUserIdIndex: 0,
          },
        });

        const exchange = await persistOfferExchange({
          tenant,
          disclosure,
        });
        await persistOfferExchange({
          tenant,
          disclosure,
          identityMatcherValues: ['adam.smith@example.com'],
        });

        const presentationEmail = await generateKYCPresentation(
          exchange,
          'email'
        );

        const response = await fastify.injectJson({
          method: 'POST',
          headers: {
            'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
          },
          url: idUrl(tenant),
          payload: {
            jwt_vp: await presentationEmail.sign(
              holderKid,
              holderKeys.privateKey,
              holderDid
            ),
            exchange_id: exchange._id,
          },
        });
        expect(response.statusCode).toEqual(500);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Internal Server Error',
            message:
              'Credential Agent only supports "pick" or "all" for "identityMatchers.rule"',
            statusCode: 500,
            errorCode: 'missing_error_code',
          })
        );
      });

      it('should match with email based matching and "pick" rule', async () => {
        const disclosure = await persistDisclosure({
          tenant,
          description: 'Credential Issuance disclosure',
          types: [{ type: 'EmailV1.0' }],
          vendorEndpoint: VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION,
          purpose: 'Identification',
          duration: '6y',
          identityMatchers: {
            rules: [
              {
                valueIndex: 0, // used for identifying the value
                path: ['$.emails'], // jsonPath within the credential
                rule: 'pick', // Rule to execute can be pick, all (if the target is an array), equal (if the target is a singleValue)
              },
            ],
            vendorUserIdIndex: 0,
          },
        });
        const exchangeWithoutIdentityMatcherValues = await persistOfferExchange(
          {
            tenant,
            disclosure,
          }
        );

        await persistOfferExchange({
          tenant,
          disclosure,
          identityMatcherValues: ['not-match.olivia@example.com'],
        });
        await persistOfferExchange({
          tenant,
          disclosure,
          identityMatcherValues: ['Adam.smith@example.com'],
        });
        const vendorUserId = 'Adam.smith@example.com';

        const presentationEmail = await generateKYCPresentation(
          exchangeWithoutIdentityMatcherValues,
          'email'
        );

        const response = await fastify.injectJson({
          method: 'POST',
          headers: {
            'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
          },
          url: idUrl(tenant),
          payload: {
            jwt_vp: await presentationEmail.sign(
              holderKid,
              holderKeys.privateKey,
              holderDid
            ),
            exchange_id: exchangeWithoutIdentityMatcherValues._id,
          },
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          token: expect.any(String),
          exchange: {
            disclosureComplete: true,
            exchangeComplete: false,
            id: exchangeWithoutIdentityMatcherValues._id,
            type: ExchangeTypes.ISSUING,
          },
        });

        const dbResult = await mongoDb()
          .collection('vendorUserIdMappings')
          .findOne({ vendorUserId });
        const { sub } = decodeJwt(response.json.token);
        expect(dbResult).toEqual({
          _id: new ObjectId(sub),
          vendorUserId,
          tenantId: new ObjectId(tenant._id),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
        const exchangeDBResult = await mongoDb()
          .collection('exchanges')
          .findOne({
            _id: new ObjectId(exchangeWithoutIdentityMatcherValues._id),
          });
        expect(exchangeDBResult).toEqual(
          mongoify({
            ...exchangeWithoutIdentityMatcherValues,
            tenantId: tenant._id,
            presentationId: presentationEmail.presentation.id,
            disclosureConsentedAt: expect.any(Date),
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
              { state: ExchangeStates.IDENTIFIED, timestamp: expect.any(Date) },
            ],
            offerHashes: [],
            ...credentialTypesObject,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          })
        );
      });
    });
  });

  describe('using the webhook', () => {
    let exchange;
    let disclosure;
    let vendorUserId;

    beforeEach(async () => {
      fastify.resetOverrides();
      disclosure = await persistDisclosure({
        tenant,
        description: 'Credential Issuance disclosure',
        types: [{ type: 'EmailV1.0' }],
        vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
        purpose: 'Identification',
        duration: '6y',
      });
      ({ vendorUserId } = await newVendorUserIdMapping());
      exchange = await persistOfferExchange({ tenant, disclosure });
    });

    it('should 200 when the presentation is empty but the vendorOriginContext is sent', async () => {
      const preauthDisclosure = await persistDisclosure({
        tenant,
        description: 'Credential Issuance disclosure',
        identificationMethods: ['preauth'],
        vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
        purpose: 'Identification',
        duration: '6y',
      });
      const emptyDisclosureExchange = await persistOfferExchange({
        tenant,
        disclosure: preauthDisclosure,
      });
      const presentationIdDocument = await generateKYCPresentation(
        emptyDisclosureExchange,
        'nothing'
      );
      presentationIdDocument.presentation.vendorOriginContext = '123';

      let identifyWebhookPayload;
      nock(mockVendorUrl)
        .post(identifyUserOnVendorEndpoint)
        .reply(200, (uri, body) => {
          identifyWebhookPayload = body;
          return {
            vendorUserId,
          };
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers: {
          'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
        },
        payload: {
          exchange_id: emptyDisclosureExchange._id,
          jwt_vp: await presentationIdDocument.sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        token: expect.any(String),
        exchange: {
          disclosureComplete: true,
          exchangeComplete: false,
          id: emptyDisclosureExchange._id,
          type: ExchangeTypes.ISSUING,
        },
      });
      const dbResult = await mongoDb()
        .collection('vendorUserIdMappings')
        .findOne({ vendorUserId });
      const { sub } = decodeJwt(response.json.token);
      expect(dbResult).toEqual({
        _id: new ObjectId(sub),
        vendorUserId,
        tenantId: new ObjectId(tenant._id),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(
        await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(emptyDisclosureExchange._id) })
      ).toEqual(
        expectedExchange(
          tenant,
          emptyDisclosureExchange,
          presentationIdDocument,
          [
            ExchangeStates.NEW,
            ExchangeStates.DISCLOSURE_RECEIVED,
            ExchangeStates.DISCLOSURE_CHECKED,
            ExchangeStates.IDENTIFIED,
          ]
        )
      );
      expect(identifyWebhookPayload).toEqual({
        emailCredentials: [],
        emails: [],
        exchangeId: emptyDisclosureExchange._id,
        idDocumentCredentials: [],
        phoneCredentials: [],
        phones: [],
        vendorOriginContext: '123',
        tenantDID: tenant.did,
        tenantId: tenant._id,
      });
    });

    it('should 200 when sub is new', async () => {
      const presentationIdDocument = await generateKYCPresentation(
        exchange,
        'idDocument'
      );

      let identifyWebhookPayload;
      nock(mockVendorUrl)
        .post(identifyUserOnVendorEndpoint)
        .reply(200, (uri, body) => {
          identifyWebhookPayload = body;
          return {
            vendorUserId,
          };
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers: {
          'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
        },
        payload: {
          exchange_id: exchange._id,
          jwt_vp: await presentationIdDocument.sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        token: expect.any(String),
        exchange: {
          disclosureComplete: true,
          exchangeComplete: false,
          id: exchange._id,
          type: ExchangeTypes.ISSUING,
        },
      });
      const dbResult = await mongoDb()
        .collection('vendorUserIdMappings')
        .findOne({ vendorUserId });
      const { sub } = decodeJwt(response.json.token);
      expect(dbResult).toEqual({
        _id: new ObjectId(sub),
        vendorUserId,
        tenantId: new ObjectId(tenant._id),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(
        await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) })
      ).toEqual(
        expectedExchange(tenant, exchange, presentationIdDocument, [
          ExchangeStates.NEW,
          ExchangeStates.DISCLOSURE_RECEIVED,
          ExchangeStates.DISCLOSURE_CHECKED,
          ExchangeStates.IDENTIFIED,
        ])
      );
      expect(identifyWebhookPayload).toEqual({
        emailCredentials: [],
        emails: [],
        exchangeId: exchange._id,
        idDocumentCredentials: [
          {
            id: idDocPayload.vc.id,
            type: ['IdDocumentV1.0', 'VerifiableCredential'],
            credentialSubject: idDocPayload.vc.credentialSubject,
            credentialType: 'IdDocumentV1.0',
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            issuer: {
              id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
            },
            validFrom: '2017-09-01',
            validUntil: '2021-09-01',
            credentialChecks: DEFAULT_CREDENTIAL_CHECKS,
          },
        ],
        phoneCredentials: [],
        phones: [],
        tenantDID: tenant.did,
        tenantId: tenant._id,
      });
    });

    it('should 200 when tenant has a custom webhook', async () => {
      const webhookUrl = 'http://cutomUrl.com';
      const customTenant = await persistTenant({
        webhookUrl,
      });

      const keyPair = generateKeyPair({ format: 'jwk' });

      await persistKey({
        tenant: customTenant,
        kidFragment: '#ID1',
        keyPair,
      });

      const customDisclosure = await persistDisclosure({
        tenant: customTenant,
        description: 'Credential Issuance disclosure',
        types: [{ type: 'EmailV1.0' }],
        vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
        purpose: 'Identification',
        duration: '6y',
      });

      const customExchange = await persistOfferExchange({
        tenant: customTenant,
        disclosure: customDisclosure,
      });

      const presentationIdDocument = await generateKYCPresentation(
        customExchange,
        'idDocument'
      );

      let identifyWebhookPayload;
      const nockWebhook = await nock(webhookUrl)
        .post(identifyUserOnVendorEndpoint)
        .reply(200, (uri, body) => {
          identifyWebhookPayload = body;
          return {
            vendorUserId,
          };
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(customTenant),
        headers: {
          'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
        },
        payload: {
          exchange_id: customExchange._id,
          jwt_vp: await presentationIdDocument.sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        token: expect.any(String),
        exchange: {
          disclosureComplete: true,
          exchangeComplete: false,
          id: customExchange._id,
          type: ExchangeTypes.ISSUING,
        },
      });
      const dbResult = await mongoDb()
        .collection('vendorUserIdMappings')
        .findOne({ vendorUserId });
      const { sub } = decodeJwt(response.json.token);
      expect(dbResult).toEqual({
        _id: new ObjectId(sub),
        vendorUserId,
        tenantId: new ObjectId(customTenant._id),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(
        await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(customExchange._id) })
      ).toEqual(
        expectedExchange(customTenant, customExchange, presentationIdDocument, [
          ExchangeStates.NEW,
          ExchangeStates.DISCLOSURE_RECEIVED,
          ExchangeStates.DISCLOSURE_CHECKED,
          ExchangeStates.IDENTIFIED,
        ])
      );
      expect(nockWebhook.isDone()).toEqual(true);
      expect(identifyWebhookPayload).toEqual({
        emailCredentials: [],
        emails: [],
        exchangeId: customExchange._id,
        idDocumentCredentials: [
          {
            id: idDocPayload.vc.id,
            type: ['IdDocumentV1.0', 'VerifiableCredential'],
            credentialSubject: idDocPayload.vc.credentialSubject,
            credentialType: 'IdDocumentV1.0',
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            issuer: {
              id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
            },
            validFrom: '2017-09-01',
            validUntil: '2021-09-01',
            credentialChecks: DEFAULT_CREDENTIAL_CHECKS,
          },
        ],
        phoneCredentials: [],
        phones: [],
        tenantDID: customTenant.did,
        tenantId: customTenant._id,
      });
    });

    it('should 200 when tenant has a custom webhook with custom webhookAuth', async () => {
      const webhookUrl = 'http://cutomUrl.com';
      const customTenant = await persistTenant({
        webhookUrl,
        webhookAuth: {
          type: 'bearer',
          bearerToken: 'secret',
        },
      });

      const keyPair = generateKeyPair({ format: 'jwk' });

      await persistKey({
        tenant: customTenant,
        kidFragment: '#ID1',
        keyPair,
      });

      const customDisclosure = await persistDisclosure({
        tenant: customTenant,
        description: 'Credential Issuance disclosure',
        types: [{ type: 'EmailV1.0' }],
        vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
        purpose: 'Identification',
        duration: '6y',
      });

      const customExchange = await persistOfferExchange({
        tenant: customTenant,
        disclosure: customDisclosure,
      });

      const presentationIdDocument = await generateKYCPresentation(
        customExchange,
        'idDocument'
      );

      let identifyWebhookPayload;
      let identityWebhookHeaders;
      const nockWebhook = await nock(webhookUrl)
        .post(identifyUserOnVendorEndpoint)
        // eslint-disable-next-line prefer-arrow-functions/prefer-arrow-functions
        .reply(200, function namedFn(uri, body) {
          identityWebhookHeaders = this.req.headers;
          identifyWebhookPayload = body;
          return {
            vendorUserId,
          };
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(customTenant),
        headers: {
          'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
        },
        payload: {
          exchange_id: customExchange._id,
          jwt_vp: await presentationIdDocument.sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
        },
      });

      expect(response.statusCode).toEqual(200);

      expect(nockWebhook.isDone()).toEqual(true);
      expect(identifyWebhookPayload).toEqual({
        emailCredentials: [],
        emails: [],
        exchangeId: customExchange._id,
        idDocumentCredentials: [
          {
            id: idDocPayload.vc.id,
            type: ['IdDocumentV1.0', 'VerifiableCredential'],
            credentialSubject: idDocPayload.vc.credentialSubject,
            credentialType: 'IdDocumentV1.0',
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            issuer: {
              id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
            },
            validFrom: '2017-09-01',
            validUntil: '2021-09-01',
            credentialChecks: DEFAULT_CREDENTIAL_CHECKS,
          },
        ],
        phoneCredentials: [],
        phones: [],
        tenantDID: customTenant.did,
        tenantId: customTenant._id,
      });
      expect(identityWebhookHeaders.authorization).toEqual('Bearer secret');
    });

    it('should 200 when identifying email and a coupon was not provided', async () => {
      const presentationEmail = await generateKYCPresentation(
        exchange,
        'email'
      );
      metadataRegistration.initVerificationCoupon.mockImplementation(() => ({
        getCoupon: () => Promise.resolve(null),
      }));

      let identifyWebhookPayload;
      nock(mockVendorUrl)
        .post(identifyUserOnVendorEndpoint)
        .reply(200, (uri, body) => {
          identifyWebhookPayload = body;
          return {
            vendorUserId,
          };
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers: {
          'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
        },
        payload: {
          jwt_vp: await presentationEmail.sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
          exchange_id: exchange._id,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        token: expect.any(String),
        exchange: {
          disclosureComplete: true,
          exchangeComplete: false,
          id: exchange._id,
          type: ExchangeTypes.ISSUING,
        },
      });
      const dbResult = await mongoDb()
        .collection('vendorUserIdMappings')
        .findOne({ vendorUserId });
      const { sub } = decodeJwt(response.json.token);
      expect(dbResult).toEqual({
        _id: new ObjectId(sub),
        vendorUserId,
        tenantId: new ObjectId(tenant._id),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(
        await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) })
      ).toEqual(
        expectedExchange(tenant, exchange, presentationEmail, [
          ExchangeStates.NEW,
          ExchangeStates.DISCLOSURE_RECEIVED,
          ExchangeStates.DISCLOSURE_CHECKED,
          ExchangeStates.IDENTIFIED,
        ])
      );
      expect(identifyWebhookPayload).toEqual({
        emailCredentials: [
          {
            id: emailPayload.vc.id,
            type: ['EmailV1.0', 'VerifiableCredential'],
            credentialSubject: emailPayload.vc.credentialSubject,
            credentialType: 'EmailV1.0',
            issuer: {
              id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
            },
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            credentialChecks: DEFAULT_CREDENTIAL_CHECKS,
          },
        ],
        idDocumentCredentials: [],
        phoneCredentials: [],
        emails: [emailPayload.vc.credentialSubject.email],
        phones: [],
        vendorOrganizationId: tenant.vendorOrganizationId,
        tenantDID: tenant.did,
        tenantId: tenant._id,
        exchangeId: exchange._id,
      });
      metadataRegistration.initVerificationCoupon.mockImplementation(() => ({
        getCoupon: () => Promise.resolve(42),
      }));
    });
    it('should 200 when identifying email', async () => {
      const presentationEmail = await generateKYCPresentation(
        exchange,
        'email'
      );

      let identifyWebhookPayload;
      nock(mockVendorUrl)
        .post(identifyUserOnVendorEndpoint)
        .reply(200, (uri, body) => {
          identifyWebhookPayload = body;
          return {
            vendorUserId,
          };
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers: {
          'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
        },
        payload: {
          jwt_vp: await presentationEmail.sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
          exchange_id: exchange._id,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        token: expect.any(String),
        exchange: {
          disclosureComplete: true,
          exchangeComplete: false,
          id: exchange._id,
          type: ExchangeTypes.ISSUING,
        },
      });
      const dbResult = await mongoDb()
        .collection('vendorUserIdMappings')
        .findOne({ vendorUserId });
      const { sub } = decodeJwt(response.json.token);
      expect(dbResult).toEqual({
        _id: new ObjectId(sub),
        vendorUserId,
        tenantId: new ObjectId(tenant._id),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(
        await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) })
      ).toEqual(
        expectedExchange(tenant, exchange, presentationEmail, [
          ExchangeStates.NEW,
          ExchangeStates.DISCLOSURE_RECEIVED,
          ExchangeStates.DISCLOSURE_CHECKED,
          ExchangeStates.IDENTIFIED,
        ])
      );
      expect(identifyWebhookPayload).toEqual({
        emailCredentials: [
          {
            id: emailPayload.vc.id,
            type: ['EmailV1.0', 'VerifiableCredential'],
            credentialSubject: emailPayload.vc.credentialSubject,
            credentialType: 'EmailV1.0',
            issuer: {
              id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
            },
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            credentialChecks: DEFAULT_CREDENTIAL_CHECKS,
          },
        ],
        idDocumentCredentials: [],
        phoneCredentials: [],
        emails: [emailPayload.vc.credentialSubject.email],
        phones: [],
        tenantDID: tenant.did,
        tenantId: tenant._id,
        exchangeId: exchange._id,
      });
    });

    it('should 200 when identifying whatever with logo and email', async () => {
      const presentationEmail = await generateKYCPresentation(
        exchange,
        'whateverWithLogoName'
      );

      let identifyWebhookPayload;
      nock(mockVendorUrl)
        .post(identifyUserOnVendorEndpoint)
        .reply(200, (uri, body) => {
          identifyWebhookPayload = body;
          return {
            vendorUserId,
          };
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers: {
          'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
        },
        payload: {
          jwt_vp: await presentationEmail.sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
          exchange_id: exchange._id,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        token: expect.any(String),
        exchange: {
          disclosureComplete: true,
          exchangeComplete: false,
          id: exchange._id,
          type: ExchangeTypes.ISSUING,
        },
      });
      const dbResult = await mongoDb()
        .collection('vendorUserIdMappings')
        .findOne({ vendorUserId });
      const { sub } = decodeJwt(response.json.token);
      expect(dbResult).toEqual({
        _id: new ObjectId(sub),
        vendorUserId,
        tenantId: new ObjectId(tenant._id),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(
        await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) })
      ).toEqual(
        expectedExchange(tenant, exchange, presentationEmail, [
          ExchangeStates.NEW,
          ExchangeStates.DISCLOSURE_RECEIVED,
          ExchangeStates.DISCLOSURE_CHECKED,
          ExchangeStates.IDENTIFIED,
        ])
      );
      expect(identifyWebhookPayload).toEqual({
        emailCredentials: [
          {
            id: emailPayload.vc.id,
            type: ['EmailV1.0', 'VerifiableCredential'],
            credentialSubject: emailPayload.vc.credentialSubject,
            credentialType: 'EmailV1.0',
            issuer: {
              id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
              image: 'https://example.com/image.png',
              name: 'Whatever',
            },
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            credentialChecks: DEFAULT_CREDENTIAL_CHECKS,
          },
        ],
        idDocumentCredentials: [],
        phoneCredentials: [],
        emails: [emailPayload.vc.credentialSubject.email],
        phones: [],
        tenantDID: tenant.did,
        tenantId: tenant._id,
        exchangeId: exchange._id,
      });
    });

    it('should 200 when identifying legacy email', async () => {
      const presentationEmail = await generateKYCPresentation(
        exchange,
        'legacyEmail'
      );

      let identifyWebhookPayload;
      nock(mockVendorUrl)
        .post(identifyUserOnVendorEndpoint)
        .reply(200, (uri, body) => {
          identifyWebhookPayload = body;
          return {
            vendorUserId,
          };
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers: {
          'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
        },
        payload: {
          jwt_vp: await presentationEmail.sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
          exchange_id: exchange._id,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        token: expect.any(String),
        exchange: {
          disclosureComplete: true,
          exchangeComplete: false,
          id: exchange._id,
          type: ExchangeTypes.ISSUING,
        },
      });
      const dbResult = await mongoDb()
        .collection('vendorUserIdMappings')
        .findOne({ vendorUserId });
      const { sub } = decodeJwt(response.json.token);
      expect(dbResult).toEqual({
        _id: new ObjectId(sub),
        vendorUserId,
        tenantId: new ObjectId(tenant._id),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(
        await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) })
      ).toEqual(
        expectedExchange(tenant, exchange, presentationEmail, [
          ExchangeStates.NEW,
          ExchangeStates.DISCLOSURE_RECEIVED,
          ExchangeStates.DISCLOSURE_CHECKED,
          ExchangeStates.IDENTIFIED,
        ])
      );
      expect(identifyWebhookPayload).toEqual({
        emailCredentials: [
          {
            id: emailPayload.vc.id,
            type: ['Email', 'VerifiableCredential'],
            credentialSubject: emailPayload.vc.credentialSubject,
            credentialType: 'Email',
            issuer: {
              id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
            },
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            credentialChecks: DEFAULT_CREDENTIAL_CHECKS,
          },
        ],
        idDocumentCredentials: [],
        phoneCredentials: [],
        emails: [emailPayload.vc.credentialSubject.email],
        phones: [],
        tenantDID: tenant.did,
        tenantId: tenant._id,
        exchangeId: exchange._id,
      });
    });

    it('should 200 when identifying phone', async () => {
      const presentationPhone = await generateKYCPresentation(
        exchange,
        'phone'
      );

      let identifyWebhookPayload;
      nock(mockVendorUrl)
        .post(identifyUserOnVendorEndpoint)
        .reply(200, (uri, body) => {
          identifyWebhookPayload = body;
          return {
            vendorUserId,
          };
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers: {
          'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
        },
        payload: {
          jwt_vp: await presentationPhone.sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
          exchange_id: exchange._id,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        token: expect.any(String),
        exchange: {
          disclosureComplete: true,
          exchangeComplete: false,
          id: exchange._id,
          type: ExchangeTypes.ISSUING,
        },
      });
      const dbResult = await mongoDb()
        .collection('vendorUserIdMappings')
        .findOne({ vendorUserId });
      const { sub } = decodeJwt(response.json.token);
      expect(dbResult).toEqual({
        _id: new ObjectId(sub),
        vendorUserId,
        tenantId: new ObjectId(tenant._id),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(
        await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) })
      ).toEqual(
        expectedExchange(tenant, exchange, presentationPhone, [
          ExchangeStates.NEW,
          ExchangeStates.DISCLOSURE_RECEIVED,
          ExchangeStates.DISCLOSURE_CHECKED,
          ExchangeStates.IDENTIFIED,
        ])
      );
      expect(identifyWebhookPayload).toEqual({
        phoneCredentials: [
          {
            id: phonePayload.vc.id,
            type: ['PhoneV1.0', 'VerifiableCredential'],
            credentialSubject: phonePayload.vc.credentialSubject,
            credentialType: 'PhoneV1.0',
            issuer: {
              id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
            },
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            credentialChecks: DEFAULT_CREDENTIAL_CHECKS,
          },
        ],
        idDocumentCredentials: [],
        emailCredentials: [],
        emails: [],
        phones: [phonePayload.vc.credentialSubject.phone],
        tenantDID: tenant.did,
        tenantId: tenant._id,
        exchangeId: exchange._id,
      });
    });

    it('should 200 when identifying VerificationIdentifier', async () => {
      const presentationVerificationIdentifier = await generateKYCPresentation(
        exchange,
        'verificationIdentifier'
      );

      let identifyWebhookPayload;
      nock(mockVendorUrl)
        .post(identifyUserOnVendorEndpoint)
        .reply(200, (uri, body) => {
          identifyWebhookPayload = body;
          return {
            vendorUserId,
          };
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers: {
          'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
        },
        payload: {
          jwt_vp: await presentationVerificationIdentifier.sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
          exchange_id: exchange._id,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        token: expect.any(String),
        exchange: {
          disclosureComplete: true,
          exchangeComplete: false,
          id: exchange._id,
          type: ExchangeTypes.ISSUING,
        },
      });
      const dbResult = await mongoDb()
        .collection('vendorUserIdMappings')
        .findOne({ vendorUserId });
      const { sub } = decodeJwt(response.json.token);
      expect(dbResult).toEqual({
        _id: new ObjectId(sub),
        vendorUserId,
        tenantId: new ObjectId(tenant._id),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(
        await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) })
      ).toEqual(
        expectedExchange(tenant, exchange, presentationVerificationIdentifier, [
          ExchangeStates.NEW,
          ExchangeStates.DISCLOSURE_RECEIVED,
          ExchangeStates.DISCLOSURE_CHECKED,
          ExchangeStates.IDENTIFIED,
        ])
      );
      expect(identifyWebhookPayload).toEqual({
        phones: [],
        idDocumentCredentials: [
          {
            id: verificationIdentifierPayload.vc.id,
            type: ['VerificationIdentifier', 'VerifiableCredential'],
            credentialSubject:
              verificationIdentifierPayload.vc.credentialSubject,
            credentialType: 'VerificationIdentifier',
            issuer: {
              id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
            },
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            credentialChecks: DEFAULT_CREDENTIAL_CHECKS,
          },
        ],
        emails: [],
        phoneCredentials: [],
        emailCredentials: [],
        tenantDID: tenant.did,
        tenantId: tenant._id,
        exchangeId: exchange._id,
      });
    });

    // TODO Remove after December 2024
    it('should 200 when email & verificationIdentifier included for the "issued" claim', async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        vendorCredentialsIncludeIssuedClaim: true,
      });

      const presentation = await generateKYCPresentation(exchange, [
        'email',
        'verificationIdentifier',
      ]);

      let identifyWebhookPayload;
      nock(mockVendorUrl)
        .post(identifyUserOnVendorEndpoint)
        .reply(200, (uri, body) => {
          identifyWebhookPayload = body;
          return {
            vendorUserId,
          };
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers: {
          'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
        },
        payload: {
          jwt_vp: await presentation.sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
          exchange_id: exchange._id,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        token: expect.any(String),
        exchange: {
          disclosureComplete: true,
          exchangeComplete: false,
          id: exchange._id,
          type: ExchangeTypes.ISSUING,
        },
      });
      const dbResult = await mongoDb()
        .collection('vendorUserIdMappings')
        .findOne({ vendorUserId });
      const { sub } = decodeJwt(response.json.token);
      expect(dbResult).toEqual({
        _id: new ObjectId(sub),
        vendorUserId,
        tenantId: new ObjectId(tenant._id),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(
        await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) })
      ).toEqual(
        expectedExchange(tenant, exchange, presentation, [
          ExchangeStates.NEW,
          ExchangeStates.DISCLOSURE_RECEIVED,
          ExchangeStates.DISCLOSURE_CHECKED,
          ExchangeStates.IDENTIFIED,
        ])
      );
      expect(identifyWebhookPayload).toEqual({
        emailCredentials: [
          {
            id: emailPayload.vc.id,
            type: ['EmailV1.0', 'VerifiableCredential'],
            credentialSubject: emailPayload.vc.credentialSubject,
            credentialType: 'EmailV1.0',
            issuer: {
              id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
            },
            issued: expect.stringMatching(ISO_DATETIME_FORMAT),
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            credentialChecks: DEFAULT_CREDENTIAL_CHECKS,
          },
        ],
        idDocumentCredentials: [
          {
            id: verificationIdentifierPayload.vc.id,
            type: ['VerificationIdentifier', 'VerifiableCredential'],
            credentialSubject:
              verificationIdentifierPayload.vc.credentialSubject,
            credentialType: 'VerificationIdentifier',
            issuer: {
              id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
            },
            issued: expect.stringMatching(ISO_DATETIME_FORMAT),
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            credentialChecks: DEFAULT_CREDENTIAL_CHECKS,
          },
        ],
        phoneCredentials: [],
        emails: [emailPayload.vc.credentialSubject.email],
        phones: [],
        tenantDID: tenant.did,
        tenantId: tenant._id,
        exchangeId: exchange._id,
      });
    });

    it('should 200 when identifying unrecognized credential type', async () => {
      let bodyReceived;
      nock(mockVendorUrl)
        .post(identifyUserOnVendorEndpoint, (body) => {
          bodyReceived = body;
          return body;
        })
        .reply(200, {
          vendorUserId,
        });

      const presentationWhatever = await generateKYCPresentation(
        exchange,
        'whateverIdentifier'
      );

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers: {
          'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
        },
        payload: {
          jwt_vp: await presentationWhatever.sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
          exchange_id: exchange._id,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(bodyReceived).toEqual({
        phones: [],
        idDocumentCredentials: [
          {
            id: idDocPayload.vc.id,
            type: ['Whatever', 'VerifiableCredential'],
            credentialType: 'Whatever',
            credentialSubject: {
              email: 'adam.smith@example.com',
            },
            issuer: {
              id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
            },
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            credentialChecks: DEFAULT_CREDENTIAL_CHECKS,
          },
        ],
        emails: [],
        phoneCredentials: [],
        emailCredentials: [],
        vendorOrganizationId: tenant.vendorOrganizationId,
        tenantDID: tenant.did,
        tenantId: tenant._id,
        exchangeId: exchange._id,
      });

      expect(
        await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) })
      ).toEqual(
        expectedExchange(tenant, exchange, presentationWhatever, [
          ExchangeStates.NEW,
          ExchangeStates.DISCLOSURE_RECEIVED,
          ExchangeStates.DISCLOSURE_CHECKED,
          ExchangeStates.IDENTIFIED,
        ])
      );
    });

    it('should 200 if vcs credential not exist', async () => {
      const presentationMixed = await generateKYCPresentation(
        exchange,
        ['idDocument', 'phone'],
        { isBrokeVCS: true }
      );

      let identifyWebhookPayload;
      nock(mockVendorUrl)
        .post(identifyUserOnVendorEndpoint)
        .reply(200, (uri, body) => {
          identifyWebhookPayload = body;
          return { vendorUserId };
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers: {
          'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
        },
        payload: {
          jwt_vp: await presentationMixed.sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
          exchange_id: exchange._id,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        token: expect.any(String),
        exchange: {
          disclosureComplete: true,
          exchangeComplete: false,
          id: exchange._id,
          type: ExchangeTypes.ISSUING,
        },
      });
      const dbResult = await mongoDb()
        .collection('vendorUserIdMappings')
        .findOne({ vendorUserId });
      const { sub } = decodeJwt(response.json.token);
      expect(dbResult).toEqual({
        _id: new ObjectId(sub),
        vendorUserId,
        tenantId: new ObjectId(tenant._id),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      expect(
        await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) })
      ).toEqual(
        expectedExchange(tenant, exchange, presentationMixed, [
          ExchangeStates.NEW,
          ExchangeStates.DISCLOSURE_RECEIVED,
          ExchangeStates.DISCLOSURE_CHECKED,
          ExchangeStates.IDENTIFIED,
        ])
      );

      expect(identifyWebhookPayload).toEqual({
        phoneCredentials: [],
        phones: [],
        emails: [],
        idDocumentCredentials: [
          {
            id: idDocPayload.vc.id,
            type: ['IdDocumentV1.0', 'VerifiableCredential'],
            credentialSubject: idDocPayload.vc.credentialSubject,
            credentialType: 'IdDocumentV1.0',
            issuer: {
              id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
            },
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            validFrom: '2017-09-01',
            validUntil: '2021-09-01',
            credentialChecks: DEFAULT_CREDENTIAL_CHECKS,
          },
        ],
        emailCredentials: [],
        tenantDID: tenant.did,
        tenantId: tenant._id,
        exchangeId: exchange._id,
      });
    });

    it('should 200 when identifying mixed ', async () => {
      const presentationMixed = await generateKYCPresentation(exchange, [
        'idDocument',
        'phone',
        'email',
      ]);

      let identifyWebhookPayload;
      nock(mockVendorUrl)
        .post(identifyUserOnVendorEndpoint)
        .reply(200, (uri, body) => {
          identifyWebhookPayload = body;
          return { vendorUserId };
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers: {
          'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
        },
        payload: {
          jwt_vp: await presentationMixed.sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
          exchange_id: exchange._id,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        token: expect.any(String),
        exchange: {
          disclosureComplete: true,
          exchangeComplete: false,
          id: exchange._id,
          type: ExchangeTypes.ISSUING,
        },
      });
      const dbResult = await mongoDb()
        .collection('vendorUserIdMappings')
        .findOne({ vendorUserId });
      const { sub } = decodeJwt(response.json.token);
      expect(dbResult).toEqual({
        _id: new ObjectId(sub),
        vendorUserId,
        tenantId: new ObjectId(tenant._id),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(
        await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) })
      ).toEqual(
        expectedExchange(tenant, exchange, presentationMixed, [
          ExchangeStates.NEW,
          ExchangeStates.DISCLOSURE_RECEIVED,
          ExchangeStates.DISCLOSURE_CHECKED,
          ExchangeStates.IDENTIFIED,
        ])
      );

      expect(identifyWebhookPayload).toEqual({
        phoneCredentials: [
          {
            id: phonePayload.vc.id,
            type: ['PhoneV1.0', 'VerifiableCredential'],
            credentialSubject: phonePayload.vc.credentialSubject,
            credentialType: 'PhoneV1.0',
            issuer: {
              id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
            },
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            credentialChecks: DEFAULT_CREDENTIAL_CHECKS,
          },
        ],
        phones: [phonePayload.vc.credentialSubject.phone],
        emails: [emailPayload.vc.credentialSubject.email],
        idDocumentCredentials: [
          {
            id: idDocPayload.vc.id,
            type: ['IdDocumentV1.0', 'VerifiableCredential'],
            credentialSubject: idDocPayload.vc.credentialSubject,
            credentialType: 'IdDocumentV1.0',
            issuer: {
              id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
            },
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            validFrom: '2017-09-01',
            validUntil: '2021-09-01',
            credentialChecks: DEFAULT_CREDENTIAL_CHECKS,
          },
        ],
        emailCredentials: [
          {
            id: emailPayload.vc.id,
            type: ['EmailV1.0', 'VerifiableCredential'],
            credentialSubject: emailPayload.vc.credentialSubject,
            credentialType: 'EmailV1.0',
            issuer: {
              id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
            },
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            credentialChecks: DEFAULT_CREDENTIAL_CHECKS,
          },
        ],
        tenantDID: tenant.did,
        tenantId: tenant._id,
        exchangeId: exchange._id,
      });
    });

    it('should 200 when identifying mixed of schemas legacy versions of docs', async () => {
      const presentationMixed = await generateKYCPresentation(exchange, [
        'legacyIdDocument',
        'phone',
        'legacyEmail',
      ]);

      let identifyWebhookPayload;
      nock(mockVendorUrl)
        .post(identifyUserOnVendorEndpoint)
        .reply(200, (uri, body) => {
          identifyWebhookPayload = body;
          return { vendorUserId };
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers: {
          'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
        },
        payload: {
          jwt_vp: await presentationMixed.sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
          exchange_id: exchange._id,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        token: expect.any(String),
        exchange: {
          disclosureComplete: true,
          exchangeComplete: false,
          id: exchange._id,
          type: ExchangeTypes.ISSUING,
        },
      });
      const dbResult = await mongoDb()
        .collection('vendorUserIdMappings')
        .findOne({ vendorUserId });
      const { sub } = decodeJwt(response.json.token);
      expect(dbResult).toEqual({
        _id: new ObjectId(sub),
        vendorUserId,
        tenantId: new ObjectId(tenant._id),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      const exchangeDBResult = await mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(exchange._id) });
      expect(exchangeDBResult).toEqual(
        expectedExchange(tenant, exchange, presentationMixed, [
          ExchangeStates.NEW,
          ExchangeStates.DISCLOSURE_RECEIVED,
          ExchangeStates.DISCLOSURE_CHECKED,
          ExchangeStates.IDENTIFIED,
        ])
      );

      expect(identifyWebhookPayload).toEqual({
        firstName: 'Sam',
        lastName: 'Smith',
        phoneCredentials: [
          {
            id: phonePayload.vc.id,
            type: ['PhoneV1.0', 'VerifiableCredential'],
            credentialSubject: phonePayload.vc.credentialSubject,
            credentialType: 'PhoneV1.0',
            issuer: {
              id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
            },
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            credentialChecks: DEFAULT_CREDENTIAL_CHECKS,
          },
        ],
        phones: [phonePayload.vc.credentialSubject.phone],
        emails: [emailPayload.vc.credentialSubject.email],
        idDocumentCredentials: [
          {
            id: legacyIdDocPayload.vc.id,
            type: ['IdDocument', 'VerifiableCredential'],
            credentialSubject: legacyIdDocPayload.vc.credentialSubject,
            credentialType: 'IdDocument',
            issuer: {
              id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
            },
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            validFrom: '2017-09-01',
            validUntil: '2021-09-01',
            credentialChecks: DEFAULT_CREDENTIAL_CHECKS,
          },
        ],
        emailCredentials: [
          {
            id: emailPayload.vc.id,
            type: ['Email', 'VerifiableCredential'],
            credentialSubject: emailPayload.vc.credentialSubject,
            credentialType: 'Email',
            issuer: {
              id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
            },
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            credentialChecks: DEFAULT_CREDENTIAL_CHECKS,
          },
        ],
        tenantDID: tenant.did,
        tenantId: tenant._id,
        exchangeId: exchange._id,
      });
    });

    it('should 200 when sub is existing', async () => {
      const presentationIdDocument = await generateKYCPresentation(
        exchange,
        'idDocument'
      );

      const existingUser = await persistVendorUserIdMapping({ tenant });
      let identifyWebhookPayload;
      nock(mockVendorUrl)
        .post(identifyUserOnVendorEndpoint)
        .reply(200, (uri, body) => {
          identifyWebhookPayload = body;
          return {
            vendorUserId: existingUser.vendorUserId,
          };
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers: {
          'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
        },
        payload: {
          jwt_vp: await presentationIdDocument.sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
          exchange_id: exchange._id,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        token: expect.any(String),
        exchange: {
          disclosureComplete: true,
          exchangeComplete: false,
          id: exchange._id,
          type: ExchangeTypes.ISSUING,
        },
      });

      const dbResult = await mongoDb()
        .collection('vendorUserIdMappings')
        .findOne({ vendorUserId });
      const { sub } = decodeJwt(response.json.token);
      expect(sub).toEqual(existingUser._id.toString());
      expect(dbResult).toEqual({
        _id: new ObjectId(existingUser._id),
        vendorUserId,
        tenantId: new ObjectId(tenant._id),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      const exchangeDBResult = await mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(exchange._id) });
      expect(exchangeDBResult).toEqual(
        expectedExchange(tenant, exchange, presentationIdDocument, [
          ExchangeStates.NEW,
          ExchangeStates.DISCLOSURE_RECEIVED,
          ExchangeStates.DISCLOSURE_CHECKED,
          ExchangeStates.IDENTIFIED,
        ])
      );
      expect(identifyWebhookPayload).toEqual({
        emailCredentials: [],
        emails: [],
        exchangeId: exchange._id,
        idDocumentCredentials: [
          {
            id: idDocPayload.vc.id,
            type: ['IdDocumentV1.0', 'VerifiableCredential'],
            credentialSubject: idDocPayload.vc.credentialSubject,
            credentialType: 'IdDocumentV1.0',
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            issuer: {
              id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
            },
            validFrom: '2017-09-01',
            validUntil: '2021-09-01',
            credentialChecks: DEFAULT_CREDENTIAL_CHECKS,
          },
        ],
        phoneCredentials: [],
        phones: [],
        tenantDID: tenant.did,
        tenantId: tenant._id,
      });
      const countResult = await mongoDb()
        .collection('vendorUserIdMappings')
        .countDocuments({ vendorUserId });
      expect(countResult).toEqual(1);
    });

    it('should use another prefix url if tenant has webhookUrl', async () => {
      const webhookUrl = 'http://cutomUrl.com';
      const customTenant = await persistTenant({
        webhookUrl,
      });

      const keyPair = generateKeyPair({ format: 'jwk' });

      await persistKey({
        tenant: customTenant,
        kidFragment: '#ID1',
        keyPair,
      });

      const customDisclosure = await persistDisclosure({
        tenant: customTenant,
        description: 'Credential Issuance disclosure',
        types: [{ type: 'EmailV1.0' }],
        vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
        purpose: 'Identification',
        duration: '6y',
      });

      const customExchange = await persistOfferExchange({
        tenant: customTenant,
        disclosure: customDisclosure,
      });

      const presentationIdDocument = await generateKYCPresentation(
        customExchange,
        'idDocument'
      );

      const existingUser = await persistVendorUserIdMapping({
        tenant: customTenant,
      });
      let identifyWebhookPayload;
      const nockWebhook = await nock(webhookUrl)
        .post(identifyUserOnVendorEndpoint)
        .reply(200, (uri, body) => {
          identifyWebhookPayload = body;
          return {
            vendorUserId: existingUser.vendorUserId,
          };
        });

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(customTenant),
        headers: {
          'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
        },
        payload: {
          jwt_vp: await presentationIdDocument.sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
          exchange_id: customExchange._id,
        },
      });

      expect(nockWebhook.isDone()).toEqual(true);
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        token: expect.any(String),
        exchange: {
          disclosureComplete: true,
          exchangeComplete: false,
          id: customExchange._id,
          type: ExchangeTypes.ISSUING,
        },
      });

      const dbResult = await mongoDb()
        .collection('vendorUserIdMappings')
        .findOne({ vendorUserId });
      const { sub } = decodeJwt(response.json.token);
      expect(sub).toEqual(existingUser._id.toString());
      expect(dbResult).toEqual({
        _id: new ObjectId(existingUser._id),
        vendorUserId,
        tenantId: new ObjectId(customTenant._id),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      const exchangeDBResult = await mongoDb()
        .collection('exchanges')
        .findOne({ _id: new ObjectId(customExchange._id) });
      expect(exchangeDBResult).toEqual(
        expectedExchange(customTenant, customExchange, presentationIdDocument, [
          ExchangeStates.NEW,
          ExchangeStates.DISCLOSURE_RECEIVED,
          ExchangeStates.DISCLOSURE_CHECKED,
          ExchangeStates.IDENTIFIED,
        ])
      );
      expect(identifyWebhookPayload).toEqual({
        emailCredentials: [],
        emails: [],
        exchangeId: customExchange._id,
        idDocumentCredentials: [
          {
            id: idDocPayload.vc.id,
            type: ['IdDocumentV1.0', 'VerifiableCredential'],
            credentialSubject: idDocPayload.vc.credentialSubject,
            credentialType: 'IdDocumentV1.0',
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            issuer: {
              id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
            },
            validFrom: '2017-09-01',
            validUntil: '2021-09-01',
            credentialChecks: DEFAULT_CREDENTIAL_CHECKS,
          },
        ],
        phoneCredentials: [],
        phones: [],
        tenantDID: customTenant.did,
        tenantId: customTenant._id,
      });
      const countResult = await mongoDb()
        .collection('vendorUserIdMappings')
        .countDocuments({ vendorUserId });
      expect(countResult).toEqual(1);
    });

    it('should return 400 when jwt_vp verification failed', async () => {
      const presentationIdDocument = await generateKYCPresentation(
        exchange,
        'idDocument'
      );

      nock(mockVendorUrl).post(identifyUserOnVendorEndpoint).reply(200, {});

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers: {
          'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
        },
        payload: {
          jwt_vp: await presentationIdDocument.sign(
            'WRONG',
            holderKeys.privateKey,
            'MISSING'
          ),
          exchange_id: exchange._id,
        },
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'presentation_malformed',
          message: 'Malformed jwt_vp property: must_be_did',
          statusCode: 400,
        })
      );
    });

    it('should return 400 when no exchange', async () => {
      const presentationIdDocument = await generateKYCPresentation(
        exchange,
        'idDocument'
      );
      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers: {
          'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
        },
        payload: {
          jwt_vp: await presentationIdDocument.sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
          exchange_id: 'no-exchange',
        },
      });
      expect(response.statusCode).toEqual(404);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'exchange_not_found',
          message: 'Exchange no-exchange not found',
          statusCode: 404,
        })
      );
    });

    it('should return 401 when preauth disclosure and no vendorOriginContext', async () => {
      const preauthDisclosure = await persistDisclosure({
        tenant,
        description: 'Preauth identification disclosure',
        identificationMethods: ['preauth'],
        vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
        purpose: 'Identification',
        duration: '6y',
      });
      ({ vendorUserId } = await newVendorUserIdMapping());
      const preAuthExchange = await persistOfferExchange({
        tenant,
        disclosure: preauthDisclosure,
      });

      const presentationIdDocument = await generateKYCPresentation(
        preAuthExchange,
        'idDocument'
      ); // .override({ vendorOriginContext: 'foo' });

      const identifyWebhookNock = nock(mockVendorUrl)
        .post(identifyUserOnVendorEndpoint)
        .reply(200, {});

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers: {
          'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
        },
        payload: {
          jwt_vp: await presentationIdDocument.sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
          exchange_id: preAuthExchange._id,
        },
      });

      expect(response.statusCode).toEqual(401);
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 401,
          error: 'Unauthorized',
          errorCode: 'presentation_request_invalid',
          message:
            'Presentation for a preauth disclosure must contain a vendorOriginContext',
        })
      );

      expect(
        await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(preAuthExchange._id) })
      ).toEqual(
        expectedExchange(
          tenant,
          preAuthExchange,
          null,
          [ExchangeStates.NEW, ExchangeStates.NOT_IDENTIFIED],
          'Presentation for a preauth disclosure must contain a vendorOriginContext'
        )
      );
      expect(identifyWebhookNock.isDone()).toEqual(false);
    });

    it('should return 401 when vendor responds with no user', async () => {
      const presentationIdDocument = await generateKYCPresentation(
        exchange,
        'idDocument'
      );

      nock(mockVendorUrl).post(identifyUserOnVendorEndpoint).reply(200, {});

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers: {
          'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
        },
        payload: {
          jwt_vp: await presentationIdDocument.sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
          exchange_id: exchange._id,
        },
      });

      expect(response.statusCode).toEqual(401);

      expect(
        await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) })
      ).toEqual(
        expectedExchange(
          tenant,
          exchange,
          presentationIdDocument,
          [
            ExchangeStates.NEW,
            ExchangeStates.DISCLOSURE_RECEIVED,
            ExchangeStates.DISCLOSURE_CHECKED,
            ExchangeStates.NOT_IDENTIFIED,
          ],
          'user not found - vendorUserId property should be a string value'
        )
      );
    });

    it('should return 401 when vendor responds with no vendorUserId', async () => {
      const presentationIdDocument = await generateKYCPresentation(
        exchange,
        'idDocument'
      );

      nock(mockVendorUrl)
        .post(identifyUserOnVendorEndpoint)
        .reply(200, { foo: 'foo' });

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers: {
          'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
        },
        payload: {
          jwt_vp: await presentationIdDocument.sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
          exchange_id: exchange._id,
        },
      });

      expect(response.statusCode).toEqual(401);
      expect(
        await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) })
      ).toEqual(
        expectedExchange(
          tenant,
          exchange,
          presentationIdDocument,
          [
            ExchangeStates.NEW,
            ExchangeStates.DISCLOSURE_RECEIVED,
            ExchangeStates.DISCLOSURE_CHECKED,
            ExchangeStates.NOT_IDENTIFIED,
          ],
          'user not found - vendorUserId property should be a string value'
        )
      );
    });

    it('should return 401 when vendor responds with non-string vendorUserId', async () => {
      const presentationIdDocument = await generateKYCPresentation(
        exchange,
        'idDocument'
      );

      nock(mockVendorUrl)
        .post(identifyUserOnVendorEndpoint)
        .reply(200, { vendorUserId: 1 });

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers: {
          'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
        },
        payload: {
          jwt_vp: await presentationIdDocument.sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
          exchange_id: exchange._id,
        },
      });

      expect(response.statusCode).toEqual(401);

      expect(
        await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) })
      ).toEqual(
        expectedExchange(
          tenant,
          exchange,
          presentationIdDocument,
          [
            ExchangeStates.NEW,
            ExchangeStates.DISCLOSURE_RECEIVED,
            ExchangeStates.DISCLOSURE_CHECKED,
            ExchangeStates.NOT_IDENTIFIED,
          ],
          'user not found - vendorUserId property should be a string value'
        )
      );
    });

    it('should 401 in case user not found', async () => {
      const presentationIdDocument = await generateKYCPresentation(
        exchange,
        'idDocument'
      );

      nock(mockVendorUrl).post(identifyUserOnVendorEndpoint).reply(404);

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers: {
          'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
        },
        payload: {
          jwt_vp: await presentationIdDocument.sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
          exchange_id: exchange._id,
        },
      });

      expect(response.statusCode).toEqual(401);

      expect(
        await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) })
      ).toEqual(
        expectedExchange(
          tenant,
          exchange,
          presentationIdDocument,
          [
            ExchangeStates.NEW,
            ExchangeStates.DISCLOSURE_RECEIVED,
            ExchangeStates.DISCLOSURE_CHECKED,
            ExchangeStates.NOT_IDENTIFIED,
          ],
          'user not found'
        )
      );
    });

    it('should 400 in case exchangeId not passed', async () => {
      const existingUser = await persistVendorUserIdMapping({ tenant });
      const presentationIdDocument = await generateKYCPresentation(
        exchange,
        'idDocument'
      );

      nock(mockVendorUrl).post(identifyUserOnVendorEndpoint).reply(200, {
        vendorUserId: existingUser.vendorUserId,
      });

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers: {
          'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
        },
        payload: {
          jwt_vp: await presentationIdDocument.sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
        },
      });

      expect(response.statusCode).toEqual(400);

      expect(
        await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) })
      ).toEqual(
        expectedExchange(tenant, exchange, undefined, [ExchangeStates.NEW])
      );
    });

    it('should 500 in other cases', async () => {
      const presentationIdDocument = await generateKYCPresentation(
        exchange,
        'idDocument'
      );

      nock(mockVendorUrl).post(identifyUserOnVendorEndpoint).reply(500);

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers: {
          'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
        },
        payload: {
          jwt_vp: await presentationIdDocument.sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
          exchange_id: exchange._id,
        },
      });

      expect(response.statusCode).toEqual(502);

      expect(
        await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) })
      ).toEqual(
        expectedExchange(
          tenant,
          exchange,
          presentationIdDocument,
          [
            ExchangeStates.NEW,
            ExchangeStates.DISCLOSURE_RECEIVED,
            ExchangeStates.DISCLOSURE_CHECKED,
            ExchangeStates.UNEXPECTED_ERROR,
          ],
          'Response code 500 (Internal Server Error)'
        )
      );
    });

    it('should 409 if the exact same presentation twice', async () => {
      const presentationEmail = await generateKYCPresentation(
        exchange,
        'email'
      );

      nock(mockVendorUrl)
        .post(identifyUserOnVendorEndpoint)
        .reply(200, () => {
          return {
            vendorUserId,
          };
        });

      const headers = {
        'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
      };
      const payload = {
        jwt_vp: await presentationEmail.sign(
          holderKid,
          holderKeys.privateKey,
          holderDid
        ),
        exchange_id: exchange._id,
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers,
        payload,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        token: expect.any(String),
        exchange: {
          disclosureComplete: true,
          exchangeComplete: false,
          id: exchange._id,
          type: ExchangeTypes.ISSUING,
        },
      });

      const response2 = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers,
        payload,
      });

      expect(response2.statusCode).toEqual(409);
      expect(response2.json).toEqual(
        errorResponseMatcher({
          error: 'Conflict',
          errorCode: 'presentation_duplicate',
          message: 'Presentation has already been submitted',
          statusCode: 409,
        })
      );
    });

    it('should be able to identify twice on the same exchange', async () => {
      const presentations = await Promise.all(
        map(() => generateKYCPresentation(exchange, 'email'), [1, 1])
      );
      let identifyWebhookPayload;
      nock(mockVendorUrl)
        .post(identifyUserOnVendorEndpoint)
        .twice()
        .reply(200, (uri, body) => {
          identifyWebhookPayload = body;
          return {
            vendorUserId,
          };
        });

      const headers = {
        'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers,
        payload: {
          jwt_vp: await presentations[0].sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
          exchange_id: exchange._id,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        token: expect.any(String),
        exchange: {
          disclosureComplete: true,
          exchangeComplete: false,
          id: exchange._id,
          type: ExchangeTypes.ISSUING,
        },
      });

      const response2 = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers,
        payload: {
          jwt_vp: await presentations[1].sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
          exchange_id: exchange._id,
        },
      });

      expect(response2.statusCode).toEqual(200);
      expect(response2.json).toEqual({
        token: expect.any(String),
        exchange: {
          disclosureComplete: true,
          exchangeComplete: false,
          id: exchange._id,
          type: ExchangeTypes.ISSUING,
        },
      });
      const dbResult = await mongoDb()
        .collection('vendorUserIdMappings')
        .findOne({ vendorUserId });
      const { sub } = decodeJwt(response2.json.token);
      expect(dbResult).toEqual({
        _id: new ObjectId(sub),
        vendorUserId,
        tenantId: new ObjectId(tenant._id),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      expect(
        await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) })
      ).toEqual(
        expectedExchange(tenant, exchange, presentations[1], [
          ExchangeStates.NEW,
          ExchangeStates.DISCLOSURE_RECEIVED,
          ExchangeStates.DISCLOSURE_CHECKED,
          ExchangeStates.IDENTIFIED,
          ExchangeStates.DISCLOSURE_RECEIVED,
          ExchangeStates.DISCLOSURE_CHECKED,
          ExchangeStates.IDENTIFIED,
        ])
      );

      expect(identifyWebhookPayload).toEqual({
        emailCredentials: [
          {
            id: emailPayload.vc.id,
            type: ['EmailV1.0', 'VerifiableCredential'],
            credentialSubject: emailPayload.vc.credentialSubject,
            credentialType: 'EmailV1.0',
            issuer: {
              id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
            },
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            credentialChecks: DEFAULT_CREDENTIAL_CHECKS,
          },
        ],
        idDocumentCredentials: [],
        phoneCredentials: [],
        emails: [emailPayload.vc.credentialSubject.email],
        phones: [],
        tenantDID: tenant.did,
        tenantId: tenant._id,
        exchangeId: exchange._id,
      });
    });

    it('should be able found on second attempt', async () => {
      const presentations = await Promise.all(
        map(() => generateKYCPresentation(exchange, 'email'), [1, 1])
      );

      nock(mockVendorUrl).post(identifyUserOnVendorEndpoint).reply(404);
      const headers = {
        'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers,
        payload: {
          jwt_vp: await presentations[0].sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
          exchange_id: exchange._id,
        },
      });

      expect(response.statusCode).toEqual(401);

      let identifyWebhookPayload;
      nock(mockVendorUrl)
        .post(identifyUserOnVendorEndpoint)
        .reply(200, (uri, body) => {
          identifyWebhookPayload = body;
          return {
            vendorUserId,
          };
        });

      const response2 = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers,
        payload: {
          jwt_vp: await presentations[1].sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
          exchange_id: exchange._id,
        },
      });

      expect(response2.statusCode).toEqual(200);
      expect(response2.json).toEqual({
        token: expect.any(String),
        exchange: {
          disclosureComplete: true,
          exchangeComplete: false,
          id: exchange._id,
          type: ExchangeTypes.ISSUING,
        },
      });
      const dbResult = await mongoDb()
        .collection('vendorUserIdMappings')
        .findOne({ vendorUserId });
      const { sub } = decodeJwt(response2.json.token);
      expect(dbResult).toEqual({
        _id: new ObjectId(sub),
        vendorUserId,
        tenantId: new ObjectId(tenant._id),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(
        await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) })
      ).toEqual(
        expectedExchange(
          tenant,
          exchange,
          presentations[1],
          [
            ExchangeStates.NEW,
            ExchangeStates.DISCLOSURE_RECEIVED,
            ExchangeStates.DISCLOSURE_CHECKED,
            ExchangeStates.NOT_IDENTIFIED,
            ExchangeStates.DISCLOSURE_RECEIVED,
            ExchangeStates.DISCLOSURE_CHECKED,
            ExchangeStates.IDENTIFIED,
          ],
          'user not found'
        )
      );
      expect(identifyWebhookPayload).toEqual({
        emailCredentials: [
          {
            id: emailPayload.vc.id,
            type: ['EmailV1.0', 'VerifiableCredential'],
            credentialSubject: emailPayload.vc.credentialSubject,
            credentialType: 'EmailV1.0',
            issuer: {
              id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
            },
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            credentialChecks: DEFAULT_CREDENTIAL_CHECKS,
          },
        ],
        idDocumentCredentials: [],
        phoneCredentials: [],
        emails: [emailPayload.vc.credentialSubject.email],
        phones: [],
        tenantDID: tenant.did,
        tenantId: tenant._id,
        exchangeId: exchange._id,
      });
    });

    it('should be able to recover from a 500 and identify the second time', async () => {
      const presentations = await Promise.all(
        map(() => generateKYCPresentation(exchange, 'email'), [1, 1])
      );

      nock(mockVendorUrl).post(identifyUserOnVendorEndpoint).reply(500);
      const headers = {
        'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
      };

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers,
        payload: {
          jwt_vp: await presentations[0].sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
          exchange_id: exchange._id,
        },
      });

      expect(response.statusCode).toEqual(502);

      let identifyWebhookPayload;
      nock(mockVendorUrl)
        .post(identifyUserOnVendorEndpoint)
        .reply(200, (uri, body) => {
          identifyWebhookPayload = body;
          return {
            vendorUserId,
          };
        });

      const response2 = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers,
        payload: {
          jwt_vp: await presentations[1].sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
          exchange_id: exchange._id,
        },
      });

      expect(response2.statusCode).toEqual(200);
      expect(response2.json).toEqual({
        token: expect.any(String),
        exchange: {
          disclosureComplete: true,
          exchangeComplete: false,
          id: exchange._id,
          type: ExchangeTypes.ISSUING,
        },
      });
      const dbResult = await mongoDb()
        .collection('vendorUserIdMappings')
        .findOne({ vendorUserId });
      const { sub } = decodeJwt(response2.json.token);
      expect(dbResult).toEqual({
        _id: new ObjectId(sub),
        vendorUserId,
        tenantId: new ObjectId(tenant._id),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(
        await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) })
      ).toEqual(
        expectedExchange(
          tenant,
          exchange,
          presentations[1],
          [
            ExchangeStates.NEW,
            ExchangeStates.DISCLOSURE_RECEIVED,
            ExchangeStates.DISCLOSURE_CHECKED,
            ExchangeStates.UNEXPECTED_ERROR,
            ExchangeStates.DISCLOSURE_RECEIVED,
            ExchangeStates.DISCLOSURE_CHECKED,
            ExchangeStates.IDENTIFIED,
          ],
          'Response code 500 (Internal Server Error)'
        )
      );
      expect(identifyWebhookPayload).toEqual({
        emailCredentials: [
          {
            id: emailPayload.vc.id,
            type: ['EmailV1.0', 'VerifiableCredential'],
            credentialSubject: emailPayload.vc.credentialSubject,
            credentialType: 'EmailV1.0',
            issuer: {
              id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
            },
            issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            credentialChecks: DEFAULT_CREDENTIAL_CHECKS,
          },
        ],
        idDocumentCredentials: [],
        phoneCredentials: [],
        emails: [emailPayload.vc.credentialSubject.email],
        phones: [],
        tenantDID: tenant.did,
        tenantId: tenant._id,
        exchangeId: exchange._id,
      });
    });

    describe('version1 of the webhook. Remove by 01/12/2023', () => {
      beforeEach(() => {
        fastify.overrides.reqConfig = (config) => ({
          ...config,
          identifyWebhookVersion: 1,
        });
      });
      afterAll(() => {
        fastify.overrides.reqConfig = (config) => ({
          ...config,
          identifyWebhookVersion: 2,
        });
      });

      it('should 200 when identifying phone with version 1 of the webhook', async () => {
        const presentationPhone = await generateKYCPresentation(
          exchange,
          'phone'
        );

        let identifyWebhookPayload;
        nock(mockVendorUrl)
          .post(identifyUserOnVendorEndpoint)
          .reply(200, (uri, body) => {
            identifyWebhookPayload = body;
            return {
              vendorUserId,
            };
          });

        const response = await fastify.injectJson({
          method: 'POST',
          url: idUrl(tenant),
          payload: {
            jwt_vp: await presentationPhone.selfSign(),
            exchange_id: exchange._id,
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          exchange: {
            disclosureComplete: true,
            exchangeComplete: false,
            id: exchange._id,
            type: 'ISSUING',
          },
          token: expect.any(String),
        });
        const dbResult = await mongoDb()
          .collection('vendorUserIdMappings')
          .findOne({ vendorUserId });
        const { sub } = decodeJwt(response.json.token);
        expect(dbResult).toEqual({
          _id: new ObjectId(sub),
          vendorUserId,
          tenantId: new ObjectId(tenant._id),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
        const exchangeDBResult = await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) });
        expect(exchangeDBResult).toEqual(
          mongoify({
            _id: exchange._id,
            type: ExchangeTypes.ISSUING,
            tenantId: tenant._id,
            disclosureConsentedAt: expect.any(Date),
            disclosureId: disclosure._id,
            presentationId: presentationPhone.presentation.id,
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
              { state: ExchangeStates.IDENTIFIED, timestamp: expect.any(Date) },
            ],
            offerHashes: [],
            ...credentialTypesObject,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          })
        );
        expect(identifyWebhookPayload).toEqual({
          phoneCredentials: [
            {
              phone: phonePayload.vc.credentialSubject.phone,
              credentialType: 'PhoneV1.0',
              issuer: {
                id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
              },
              issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            },
          ],
          idDocumentCredentials: [],
          emailCredentials: [],
          emails: [],
          phones: [phonePayload.vc.credentialSubject.phone],
          tenantDID: tenant.did,
          tenantId: tenant._id,
          exchangeId: exchange._id,
        });
      });

      it('should 200 when identifying mixed with version 1 of the webhook', async () => {
        const presentationMixed = await generateKYCPresentation(exchange, [
          'idDocument',
          'phone',
          'email',
        ]);

        let identifyWebhookPayload;
        nock(mockVendorUrl)
          .post(identifyUserOnVendorEndpoint)
          .reply(200, (uri, body) => {
            identifyWebhookPayload = body;
            return {
              vendorUserId,
            };
          });

        const response = await fastify.injectJson({
          method: 'POST',
          url: idUrl(tenant),
          payload: {
            jwt_vp: await presentationMixed.selfSign(),
            exchange_id: exchange._id,
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          exchange: {
            disclosureComplete: true,
            exchangeComplete: false,
            id: exchange._id,
            type: 'ISSUING',
          },
          token: expect.any(String),
        });
        const dbResult = await mongoDb()
          .collection('vendorUserIdMappings')
          .findOne({ vendorUserId });
        const { sub } = decodeJwt(response.json.token);
        expect(dbResult).toEqual({
          _id: new ObjectId(sub),
          vendorUserId,
          tenantId: new ObjectId(tenant._id),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
        const exchangeDBResult = await mongoDb()
          .collection('exchanges')
          .findOne({ _id: new ObjectId(exchange._id) });
        expect(exchangeDBResult).toEqual(
          mongoify({
            _id: exchange._id,
            type: ExchangeTypes.ISSUING,
            tenantId: tenant._id,
            disclosureConsentedAt: expect.any(Date),
            disclosureId: disclosure._id,
            presentationId: presentationMixed.presentation.id,
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
              { state: ExchangeStates.IDENTIFIED, timestamp: expect.any(Date) },
            ],
            offerHashes: [],
            ...credentialTypesObject,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          })
        );
        expect(identifyWebhookPayload).toEqual({
          phoneCredentials: [
            {
              phone: phonePayload.vc.credentialSubject.phone,
              credentialType: 'PhoneV1.0',
              issuer: {
                id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
              },
              issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            },
          ],
          phones: [phonePayload.vc.credentialSubject.phone],
          emails: [emailPayload.vc.credentialSubject.email],
          idDocumentCredentials: [
            {
              ...idDocPayload.vc.credentialSubject,
              credentialType: 'IdDocumentV1.0',
              issuer: {
                id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
              },
              issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
              validFrom: '2017-09-01',
              validUntil: '2021-09-01',
            },
          ],
          emailCredentials: [
            {
              email: emailPayload.vc.credentialSubject.email,
              credentialType: 'EmailV1.0',
              issuer: {
                id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
              },
              issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            },
          ],
          tenantDID: tenant.did,
          tenantId: tenant._id,
          exchangeId: exchange._id,
        });
      });
    });

    describe('autoIdentityCheck Test Suite', () => {
      it('should 401 when autoIdentityCheck is on and credential has invalid check result', async () => {
        setMockVerifyCredentials({
          ...DEFAULT_CREDENTIAL_CHECKS,
          TRUSTED_ISSUER: CredentialCheckResultValue.FAIL,
        });
        const presentationEmail = await generateKYCPresentation(
          exchange,
          'email'
        );

        const response = await fastify.injectJson({
          method: 'POST',
          url: idUrl(tenant),
          headers: {
            'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
          },
          payload: {
            jwt_vp: await presentationEmail.sign(
              holderKid,
              holderKeys.privateKey,
              holderDid
            ),
            exchange_id: exchange._id,
          },
        });

        expect(response.statusCode).toEqual(401);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Unauthorized',
            message: 'presentation_credential_bad_issuer',
            statusCode: 401,
            errorCode: 'presentation_credential_bad_issuer',
          })
        );
        expect(
          await mongoDb()
            .collection('exchanges')
            .findOne({ _id: new ObjectId(exchange._id) })
        ).toEqual(
          expectedExchange(
            tenant,
            exchange,
            presentationEmail,
            [
              ExchangeStates.NEW,
              ExchangeStates.DISCLOSURE_RECEIVED,
              ExchangeStates.DISCLOSURE_CHECKED,
              ExchangeStates.NOT_IDENTIFIED,
            ],
            'presentation_credential_bad_issuer'
          )
        );
      });
      it('should 200 when autoIdentityCheck is off, vendorEndpoint is issuing-identification and credential has invalid check result', async () => {
        setMockVerifyCredentials({
          ...DEFAULT_CREDENTIAL_CHECKS,
          TRUSTED_ISSUER: CredentialCheckResultValue.FAIL,
        });
        fastify.overrides.reqConfig = (config) => ({
          ...config,
          autoIdentityCheck: false,
        });
        const presentationEmail = await generateKYCPresentation(
          exchange,
          'email'
        );

        let identifyWebhookPayload;
        nock(mockVendorUrl)
          .post(identifyUserOnVendorEndpoint)
          .reply(200, (uri, body) => {
            identifyWebhookPayload = body;
            return {
              vendorUserId,
            };
          });

        const response = await fastify.injectJson({
          method: 'POST',
          url: idUrl(tenant),
          headers: {
            'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
          },
          payload: {
            jwt_vp: await presentationEmail.sign(
              holderKid,
              holderKeys.privateKey,
              holderDid
            ),
            exchange_id: exchange._id,
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          token: expect.any(String),
          exchange: {
            disclosureComplete: true,
            exchangeComplete: false,
            id: exchange._id,
            type: ExchangeTypes.ISSUING,
          },
        });
        const dbResult = await mongoDb()
          .collection('vendorUserIdMappings')
          .findOne({ vendorUserId });
        const { sub } = decodeJwt(response.json.token);
        expect(dbResult).toEqual({
          _id: new ObjectId(sub),
          vendorUserId,
          tenantId: new ObjectId(tenant._id),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
        expect(
          await mongoDb()
            .collection('exchanges')
            .findOne({ _id: new ObjectId(exchange._id) })
        ).toEqual(
          expectedExchange(tenant, exchange, presentationEmail, [
            ExchangeStates.NEW,
            ExchangeStates.DISCLOSURE_RECEIVED,
            ExchangeStates.DISCLOSURE_CHECKED,
            ExchangeStates.IDENTIFIED,
          ])
        );
        expect(identifyWebhookPayload).toEqual({
          emailCredentials: [
            {
              id: emailPayload.vc.id,
              type: ['EmailV1.0', 'VerifiableCredential'],
              credentialSubject: emailPayload.vc.credentialSubject,
              credentialType: 'EmailV1.0',
              issuer: {
                id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
              },
              issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
              credentialChecks: {
                ...DEFAULT_CREDENTIAL_CHECKS,
                TRUSTED_ISSUER: CredentialCheckResultValue.FAIL,
              },
            },
          ],
          idDocumentCredentials: [],
          phoneCredentials: [],
          emails: [emailPayload.vc.credentialSubject.email],
          phones: [],
          tenantDID: tenant.did,
          tenantId: tenant._id,
          exchangeId: exchange._id,
        });
      });
      // eslint-disable-next-line max-len
      it('should 200 when autoIdentityCheck is off, vendorEndpoint is integrated-issuing-identification and credential has invalid check result', async () => {
        await mongoDb().collection('vendorUserIdMappings').deleteMany({});
        await mongoDb().collection('exchanges').deleteMany({});
        await mongoDb().collection('disclosures').deleteMany({});
        disclosure = await persistDisclosure({
          tenant,
          description: 'Credential Issuance disclosure',
          types: [{ type: 'EmailV1.0' }],
          vendorEndpoint: VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION,
          purpose: 'Identification',
          duration: '6y',
          identityMatchers: {
            rules: [
              {
                valueIndex: 0, // used for identifying the value
                path: ['$.emails'], // jsonPath within the credential
                rule: 'pick', // Rule to execute can be pick, all (if the target is an array), equal (if the target is a singleValue)
              },
            ],
            vendorUserIdIndex: 0,
          },
        });
        const exchangeWithoutIdentityMatcherValues = await persistOfferExchange(
          {
            tenant,
            disclosure,
          }
        );

        await persistOfferExchange({
          tenant,
          disclosure,
          identityMatcherValues: ['not-match.olivia@example.com'],
        });
        await persistOfferExchange({
          tenant,
          disclosure,
          identityMatcherValues: ['Adam.smith@example.com'],
        });
        vendorUserId = 'Adam.smith@example.com';

        const presentationEmail = await generateKYCPresentation(
          exchangeWithoutIdentityMatcherValues,
          'email'
        );
        setMockVerifyCredentials({
          ...DEFAULT_CREDENTIAL_CHECKS,
          TRUSTED_HOLDER: CredentialCheckResultValue.FAIL,
        });
        fastify.overrides.reqConfig = (config) => ({
          ...config,
          autoIdentityCheck: false,
        });

        const response = await fastify.injectJson({
          method: 'POST',
          url: idUrl(tenant),
          headers: {
            'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
          },
          payload: {
            jwt_vp: await presentationEmail.sign(
              holderKid,
              holderKeys.privateKey,
              holderDid
            ),
            exchange_id: exchangeWithoutIdentityMatcherValues._id,
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          token: expect.any(String),
          exchange: {
            disclosureComplete: true,
            exchangeComplete: false,
            id: exchangeWithoutIdentityMatcherValues._id,
            type: ExchangeTypes.ISSUING,
          },
        });
        const dbResult = await mongoDb()
          .collection('vendorUserIdMappings')
          .findOne({ vendorUserId });
        const { sub } = decodeJwt(response.json.token);
        expect(dbResult).toEqual({
          _id: new ObjectId(sub),
          vendorUserId,
          tenantId: new ObjectId(tenant._id),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
        expect(
          await mongoDb()
            .collection('exchanges')
            .findOne({
              _id: new ObjectId(exchangeWithoutIdentityMatcherValues._id),
            })
        ).toEqual(
          expectedExchange(
            tenant,
            exchangeWithoutIdentityMatcherValues,
            presentationEmail,
            [
              ExchangeStates.NEW,
              ExchangeStates.DISCLOSURE_RECEIVED,
              ExchangeStates.DISCLOSURE_CHECKED,
              ExchangeStates.IDENTIFIED,
            ]
          )
        );
      });
      it('should 200 when autoIdentityCheck is on and credential has N/A expiration', async () => {
        setMockVerifyCredentials({
          ...DEFAULT_CREDENTIAL_CHECKS,
          UNEXPIRED: CredentialCheckResultValue.NOT_APPLICABLE,
        });
        const presentationEmail = await generateKYCPresentation(
          exchange,
          'email'
        );

        let identifyWebhookPayload;
        nock(mockVendorUrl)
          .post(identifyUserOnVendorEndpoint)
          .reply(200, (uri, body) => {
            identifyWebhookPayload = body;
            return {
              vendorUserId,
            };
          });

        const response = await fastify.injectJson({
          method: 'POST',
          url: idUrl(tenant),
          headers: {
            'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
          },
          payload: {
            jwt_vp: await presentationEmail.sign(
              holderKid,
              holderKeys.privateKey,
              holderDid
            ),
            exchange_id: exchange._id,
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          token: expect.any(String),
          exchange: {
            disclosureComplete: true,
            exchangeComplete: false,
            id: exchange._id,
            type: ExchangeTypes.ISSUING,
          },
        });
        const dbResult = await mongoDb()
          .collection('vendorUserIdMappings')
          .findOne({ vendorUserId });
        const { sub } = decodeJwt(response.json.token);
        expect(dbResult).toEqual({
          _id: new ObjectId(sub),
          vendorUserId,
          tenantId: new ObjectId(tenant._id),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
        expect(
          await mongoDb()
            .collection('exchanges')
            .findOne({ _id: new ObjectId(exchange._id) })
        ).toEqual(
          expectedExchange(tenant, exchange, presentationEmail, [
            ExchangeStates.NEW,
            ExchangeStates.DISCLOSURE_RECEIVED,
            ExchangeStates.DISCLOSURE_CHECKED,
            ExchangeStates.IDENTIFIED,
          ])
        );
        expect(identifyWebhookPayload).toEqual({
          emailCredentials: [
            {
              id: emailPayload.vc.id,
              type: ['EmailV1.0', 'VerifiableCredential'],
              credentialSubject: emailPayload.vc.credentialSubject,
              credentialType: 'EmailV1.0',
              issuer: {
                id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
              },
              issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
              credentialChecks: {
                ...DEFAULT_CREDENTIAL_CHECKS,
                UNEXPIRED: CredentialCheckResultValue.NOT_APPLICABLE,
              },
            },
          ],
          idDocumentCredentials: [],
          phoneCredentials: [],
          emails: [emailPayload.vc.credentialSubject.email],
          phones: [],
          tenantDID: tenant.did,
          tenantId: tenant._id,
          exchangeId: exchange._id,
        });
      });
    });
  });

  describe('identity presentation @context validation enabled test suite', () => {
    let exchange;
    let disclosure;
    let vendorUserId;

    beforeEach(async () => {
      fastify.overrides.reqConfig = (config) => ({
        ...config,
        enablePresentationContextValidation: true,
      });
      disclosure = await persistDisclosure({
        tenant,
        description: 'Credential Issuance disclosure',
        types: [{ type: 'EmailV1.0' }],
        vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
        purpose: 'Identification',
        duration: '6y',
      });
      ({ vendorUserId } = await newVendorUserIdMapping());
      exchange = await persistOfferExchange({ tenant, disclosure });
    });

    it('should 400 when @context is a string and is incorrect value', async () => {
      const presentationIdDocument = (
        await generateKYCPresentation(exchange, 'idDocument')
      ).override({ '@context': 'foo' });

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers: {
          'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
        },
        payload: {
          exchange_id: exchange._id,
          jwt_vp: await presentationIdDocument.sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
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
      const presentationIdDocument = (
        await generateKYCPresentation(exchange, 'idDocument')
      ).override({ '@context': ['foo'] });

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers: {
          'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
        },
        payload: {
          exchange_id: exchange._id,
          jwt_vp: await presentationIdDocument.sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
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
      const presentationIdDocument = (
        await generateKYCPresentation(exchange, 'idDocument')
      ).override({ '@context': [] });

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers: {
          'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
        },
        payload: {
          exchange_id: exchange._id,
          jwt_vp: await presentationIdDocument.sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
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
      const presentationIdDocument = (
        await generateKYCPresentation(exchange, 'idDocument')
      ).override({ '@context': 'https://www.w3.org/2018/credentials/v1' });

      nock(mockVendorUrl).post(identifyUserOnVendorEndpoint).reply(200, {
        vendorUserId,
      });

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers: {
          'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
        },
        payload: {
          exchange_id: exchange._id,
          jwt_vp: await presentationIdDocument.sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
        },
      });

      expect(response.statusCode).toEqual(200);
    });
    it('should 200 when @context is an array and is correct value', async () => {
      const presentationIdDocument = (
        await generateKYCPresentation(exchange, 'idDocument')
      ).override({ '@context': ['https://www.w3.org/2018/credentials/v1'] });

      nock(mockVendorUrl).post(identifyUserOnVendorEndpoint).reply(200, {
        vendorUserId,
      });

      const response = await fastify.injectJson({
        method: 'POST',
        url: idUrl(tenant),
        headers: {
          'x-vnf-protocol-version': `${VnfProtocolVersions.VNF_PROTOCOL_VERSION_2}`,
        },
        payload: {
          exchange_id: exchange._id,
          jwt_vp: await presentationIdDocument.sign(
            holderKid,
            holderKeys.privateKey,
            holderDid
          ),
        },
      });

      expect(response.statusCode).toEqual(200);
    });
  });
});

const expectedExchange = (tenant, exchange, presentationWrapper, states, err) =>
  mongoify(
    omitBy((v) => v == null, {
      ...exchange,
      tenantId: tenant._id,
      type: ExchangeTypes.ISSUING,
      presentationId: presentationWrapper?.presentation?.id,
      disclosureConsentedAt:
        presentationWrapper == null ? undefined : expect.any(Date),
      events: map((state) => ({ state, timestamp: expect.any(Date) }), states),
      ...credentialTypesObject,
      err,
      updatedAt: expect.any(Date),
    })
  );
