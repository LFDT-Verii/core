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
const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const nock = require('nock');
const { ObjectId } = require('mongodb');
const _ = require('lodash/fp');
const {
  ISO_DATETIME_FORMAT,
  OBJECT_ID_FORMAT,
} = require('@verii/test-regexes');
const {
  errorResponseMatcher,
  mongoify,
  testAuthToken,
} = require('@verii/tests-helpers');
const { samplePresentationDefinition } = require('@verii/sample-data');
const buildFastify = require('./helpers/credentialagent-operator-build-fastify');
const {
  initDisclosureFactory,
  initFeedFactory,
  initTenantFactory,
  tenantRepoPlugin,
  VendorEndpoint,
  ConfigurationType,
} = require('../../src/entities');

const disclosureUrlPrefix = '/operator-api/v0.8/tenants/';

const disclosureUrl = (tenant) =>
  `${disclosureUrlPrefix}${tenant._id}/disclosures`;

const nockVerifiedProfile = (did, response = {}) =>
  nock('http://oracle.localhost.test')
    .get(`/api/v0.6/organizations/${encodeURIComponent(did)}/verified-profile`)
    .reply(200, response);

describe('disclosures management', () => {
  const commercialEntityName = 'Example Inc.';
  const commercialEntityLogo = 'https://www.example.com/logo.png';

  let fastify;
  let persistFeed;
  let persistDisclosure;
  let newDisclosure;
  let persistTenant;
  let tenant;
  let altTenant;
  let disclosures;
  let tenantRepo;
  let nockVP;
  let nockAltVP;

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();
    ({ persistFeed } = initFeedFactory(fastify));
    ({ persistDisclosure, newDisclosure } = initDisclosureFactory(fastify));
    ({ persistTenant } = initTenantFactory(fastify));

    tenantRepo = tenantRepoPlugin(fastify)();
  });

  beforeEach(async () => {
    fastify.resetOverrides();
    nock.cleanAll();
    await mongoDb().collection('disclosures').deleteMany({});
    await mongoDb().collection('tenants').deleteMany({});
    await mongoDb().collection('feeds').deleteMany({});

    tenant = await persistTenant();
    altTenant = await persistTenant();
    disclosures = {
      a: await persistDisclosure({ description: 'getManyTest1', tenant }),
      b: await persistDisclosure({ description: 'getManyTest2', tenant }),
      c: await persistDisclosure({
        description: 'getManyTest3',
        tenant: altTenant,
      }),
      d: await persistDisclosure({
        description: 'withoffermode',
        tenant,
        offerMode: 'preloaded',
      }),
      e: await persistDisclosure({
        description: 'withbadoffermode',
        tenant,
        offerMode: 'hello',
      }),
    };

    nockVP = nockVerifiedProfile(tenant.did, {
      credentialSubject: {
        commercialEntities: [
          {
            name: commercialEntityName,
            logo: commercialEntityLogo,
          },
        ],
      },
    });
    nockAltVP = nockVerifiedProfile(altTenant.did, {
      credentialSubject: {
        commercialEntities: [],
      },
    });
  });

  after(async () => {
    await fastify.close();
    nock.cleanAll();
    nock.restore();
  });

  describe('Create Disclosure', () => {
    describe('Create Disclosure - Common Missing Required Properties', () => {
      it('should 404 if organizationDID is blank', async () => {
        const payload = await newDisclosure({ tenant });

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl({ _id: '' })}`,
          payload,
        });

        expect(response.statusCode).toEqual(404);
      });

      it('should 401 and not create the disclosure with wrong token', async () => {
        const payload = _.omit(['tenantId'], await newDisclosure({ tenant }));

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            'x-override-auth-unauthorized': true,
          },
        });

        expect(response.statusCode).toEqual(401);
      });

      it('should 400 and fail to create an integrated identity disclosure with unexpected rule', async () => {
        const payload = _.omit(
          ['tenantId'],
          await newDisclosure({
            tenant,
            vendorEndpoint: VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION,
            types: [{ type: 'EmailV1.0' }],
            identityMatchers: {
              rules: [
                {
                  valueIndex: 0, // used for identifying the value
                  path: ['$.emails'], // jsonPath within the credential
                  rule: 'nonRule', // Rule to execute can be pick, all (if the target is an array), equal (if the target is a singleValue)
                },
              ],
              vendorUserIdIndex: 0,
              values: [
                ['adam.smith@example.com'],
                ['carmen.jones@example.com'],
              ],
            },
          })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            statusCode: 400,
            errorCode: 'request_validation_failed',
            message:
              'body/identityMatchers/rules/0/rule must be equal to one of the allowed values',
          })
        );
      });

      it('should 400 when disclosure configuration type required', async () => {
        const payload = _.omit(
          ['tenantId', 'configurationType'],
          await newDisclosure({
            tenant,
            vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
            offerMode: 'preloaded',
          })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload: {
            ...payload,
            setIssuingDefault: false,
          },
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'disclosure_configuration_type_required',
            message: 'Disclosure configuration type required',
            statusCode: 400,
          })
        );
      });

      it('should 400 when vendor webhook is not exists', async () => {
        fastify.overrides.reqConfig = (config) => ({
          ...config,
          vendorUrl: '',
        });
        const customTenant = await persistTenant({
          webhookUrl: '',
        });
        nockVerifiedProfile(customTenant.did);
        const payload = _.omit(
          ['tenantId'],
          await newDisclosure({ customTenant })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'vendor_url_required',
            message: 'Vendor URL is required',
            statusCode: 400,
          })
        );
        fastify.resetOverrides();
      });

      it('should 400 if no commercial entity', async () => {
        const payload = _.omit(
          ['tenantId'],
          await newDisclosure({
            tenant,
            offerMode: 'preloaded',
            commercialEntityName: 'abc',
            commercialEntityLogo: 'dsa',
          })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'invalid_commercial_entity',
            message: 'Invalid commercial entity',
            statusCode: 400,
          })
        );
        expect(nockVP.isDone()).toBe(true);
      });

      it('should 500 if registrar does not response', async () => {
        nock.cleanAll();
        const payload = _.omit(
          ['tenantId'],
          await newDisclosure({
            tenant,
            offerMode: 'preloaded',
          })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });
        expect(response.statusCode).toEqual(500);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Internal Server Error',
            errorCode: 'missing_error_code',
            statusCode: 500,
          })
        );
      }, 20000);

      it('should 400 if commercial entity is only a partial match', async () => {
        const payload = _.omit(
          ['tenantId'],
          await newDisclosure({
            tenant,
            offerMode: 'preloaded',
            commercialEntityName: 'not-match',
            commercialEntityLogo: 'https://www.example.com/logo.png',
          })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'invalid_commercial_entity',
            message: 'Invalid commercial entity',
            statusCode: 400,
          })
        );
        expect(nockVP.isDone()).toBe(true);
      });

      it('should 400 if commercial entity is empty array', async () => {
        const payload = _.omit(
          ['tenantId'],
          await newDisclosure({
            tenant: altTenant,
            offerMode: 'preloaded',
            commercialEntityName: 'abc',
            commercialEntityLogo: 'dsa',
          })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(altTenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'invalid_commercial_entity',
            message: 'Invalid commercial entity',
            statusCode: 400,
          })
        );
        expect(nockAltVP.isDone()).toBe(true);
      });
    });

    describe('Create Disclosure - Inspection Configuration', () => {
      it('should 400 when types are not provided', async () => {
        const payload = _.omit(
          ['tenantId', 'types'],
          await newDisclosure({ tenant })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'types_required',
            statusCode: 400,
            error: 'Bad Request',
            message: 'Types should has minimum one item',
          })
        );
      });

      it('should 400 when empty types is provided', async () => {
        const payload = _.flow(
          _.omit(['tenantId']),
          _.set('types', [])
        )(await newDisclosure({ tenant }));
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'request_validation_failed',
            statusCode: 400,
            error: 'Bad Request',
            message: 'body/types must NOT have fewer than 1 items',
          })
        );
      });

      it('should 400 when empty object provided in types array', async () => {
        const payload = _.flow(
          _.omit(['tenantId']),
          _.set('types', [{}])
        )(await newDisclosure({ tenant }));
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'request_validation_failed',
            statusCode: 400,
            error: 'Bad Request',
            message: "body should have required property 'types'",
          })
        );
      });

      it('should 400 when missing duration', async () => {
        const payload = _.omit(
          ['tenantId', 'duration'],
          await newDisclosure({
            tenant,
            configurationType: ConfigurationType.INSPECTION,
            identificationMethods: ['verifiable_presentation'],
            vendorEndpoint: 'receive-applicant',
          })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'duration_required',
            message: 'Duration is required',
            statusCode: 400,
          })
        );
      });

      it('should 400 when missing Purpose', async () => {
        const payload = _.omit(
          ['tenantId', 'purpose'],
          await newDisclosure({
            tenant,
            configurationType: ConfigurationType.INSPECTION,
            identificationMethods: ['verifiable_presentation'],
            vendorEndpoint: 'receive-applicant',
          })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'purpose_required',
            message: 'Purpose is required',
            statusCode: 400,
          })
        );
      });

      it('should 400 when feed is true and configurationType is not inspection', async () => {
        const payload = {
          ..._.omit(
            ['tenantId'],
            await newDisclosure({
              tenant,
              configurationType: 'issuing',
              vendorEndpoint: 'issuing-identification',
              setIssuingDefault: true,
              feed: true,
            })
          ),
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'issuing_feed_not_supported',
            message: 'Issuing feeds are not supported',
            statusCode: 400,
          })
        );
      });

      it('should create a particular disclosure with offerMode', async () => {
        const payload = _.omit(
          ['tenantId'],
          await newDisclosure({ tenant, offerMode: 'preloaded' })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });
        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          createdAt: expect.any(String),
          description: 'Clerk',
          duration: '6y',
          id: expect.any(String),
          identificationMethods: ['verifiable_presentation'],
          offerMode: 'preloaded',
          purpose: 'Job Application',
          sendPushOnVerification: false,
          termsUrl: 'https://www.lipsum.com/feed/html',
          feed: false,
          types: [
            { type: 'PastEmploymentPosition' },
            { type: 'CurrentEmploymentPosition' },
          ],
          updatedAt: expect.any(String),
          vendorDisclosureId: 'HR-PKG-USPS-CLRK',
          vendorEndpoint: 'receive-applicant',
          configurationType: 'inspection',
          deactivationDate: expect.any(String),
          authTokensExpireIn: 10080,
        });
      });

      it('should create a disclosure with commercial entity', async () => {
        const payload = _.omit(
          ['tenantId'],
          await newDisclosure({
            tenant,
            offerMode: 'preloaded',
            commercialEntityName,
            commercialEntityLogo,
          })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });
        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          createdAt: expect.any(String),
          description: 'Clerk',
          duration: '6y',
          id: expect.any(String),
          identificationMethods: ['verifiable_presentation'],
          offerMode: 'preloaded',
          purpose: 'Job Application',
          sendPushOnVerification: false,
          termsUrl: 'https://www.lipsum.com/feed/html',
          feed: false,
          types: [
            { type: 'PastEmploymentPosition' },
            { type: 'CurrentEmploymentPosition' },
          ],
          commercialEntityName,
          commercialEntityLogo,
          updatedAt: expect.any(String),
          vendorDisclosureId: 'HR-PKG-USPS-CLRK',
          vendorEndpoint: 'receive-applicant',
          configurationType: 'inspection',
          deactivationDate: expect.any(String),
          authTokensExpireIn: 10080,
        });
        expect(nockVP.isDone()).toBe(true);
      });

      it('should create disclosure if tenant has webhookUrl', async () => {
        fastify.overrides.reqConfig = (config) => ({
          ...config,
          vendorUrl: '',
        });
        const customTenant = await persistTenant({
          webhookUrl: 'http://test.io',
        });
        nockVerifiedProfile(customTenant.did);
        const payload = _.omit(
          ['tenantId'],
          await newDisclosure({ tenant: customTenant, offerMode: 'preloaded' })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(customTenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });
        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          createdAt: expect.any(String),
          description: 'Clerk',
          duration: '6y',
          id: expect.any(String),
          identificationMethods: ['verifiable_presentation'],
          offerMode: 'preloaded',
          purpose: 'Job Application',
          sendPushOnVerification: false,
          termsUrl: 'https://www.lipsum.com/feed/html',
          feed: false,
          types: [
            { type: 'PastEmploymentPosition' },
            { type: 'CurrentEmploymentPosition' },
          ],
          updatedAt: expect.any(String),
          vendorDisclosureId: 'HR-PKG-USPS-CLRK',
          vendorEndpoint: 'receive-applicant',
          configurationType: 'inspection',
          deactivationDate: expect.any(String),
          authTokensExpireIn: 10080,
        });
      });

      it('should 201 when feed is true and configurationType is inspection', async () => {
        const payload = {
          ..._.omit(
            ['tenantId'],
            await newDisclosure({
              tenant,
              feed: true,
            })
          ),
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          ..._.omit(
            ['presentationDefinition.submission_requirements[0].foo'],
            payload
          ),
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          identificationMethods: ['verifiable_presentation'],
          deactivationDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });
        const dbResult = await mongoDb()
          .collection('disclosures')
          .findOne({ _id: new ObjectId(response.json.id) });
        expect(dbResult).toEqual({
          ...mongoify(_.omit(['id'], response.json)),
          _id: new ObjectId(response.json.id),
          tenantId: new ObjectId(tenant._id),
        });
        expect(dbResult.feed).toEqual(true);
      });
    });

    describe('Create Disclosure - Issuing Missing Required Properties', () => {
      it('should 400 creating disclosure with invalid offerMode', async () => {
        const payload = {
          ..._.omit(['createdAt', 'updatedAt', '_id'], disclosures.a),
          offerMode: 'blabla',
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'request_validation_failed',
            statusCode: 400,
            error: 'Bad Request',
            message:
              'body/offerMode must be equal to one of the allowed values',
          })
        );
      });

      it('should 400 when default disclosure type mismatch', async () => {
        const payload = _.omit(
          ['tenantId'],
          await newDisclosure({
            tenant,
          })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload: {
            ...payload,
            setIssuingDefault: true,
          },
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'issuing_default_not_compatible',
            message: 'The default disclosure cannot be of type "inspection"',
            statusCode: 400,
          })
        );
      });

      it('should 400 when configuration type is wrong', async () => {
        const payload = _.omit(
          ['tenantId'],
          await newDisclosure({
            tenant,
            vendorEndpoint: VendorEndpoint.RECEIVE_APPLICANT,
            configurationType: ConfigurationType.ISSUING,
          })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'disclosure_invalid',
            message: 'Disclosure configuration type invalid',
            statusCode: 400,
          })
        );
      });

      it('should 400 when default disclosure not set', async () => {
        const payload = _.omit(
          ['tenantId'],
          await newDisclosure({
            tenant,
            configurationType: ConfigurationType.ISSUING,
            vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
            offerMode: 'preloaded',
          })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload: {
            ...payload,
            setIssuingDefault: false,
          },
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'first_issuing_configuration_must_be_default',
            message:
              'The first "issuing" configuration created must be set as the default.',
            statusCode: 400,
          })
        );
      });

      it('should 400 when missing offer mode', async () => {
        const payload = _.omit(
          ['tenantId', 'offerMode'],
          await newDisclosure({
            tenant,
            configurationType: ConfigurationType.ISSUING,
            identificationMethods: ['preauth'],
            vendorEndpoint: 'issuing-identification',
          })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'offer_mode_required',
            message: 'Offer mode is required',
            statusCode: 400,
          })
        );
      });
    });

    describe('Create Disclosure - Issuing + VP Identification Method', () => {
      it('should 400 if identificationMethods is set to [verifiable_presentation] and types is not passed', async () => {
        const payload = _.flow(_.omit(['tenantId', 'types']))(
          await newDisclosure({
            tenant,
            identificationMethods: ['verifiable_presentation'],
          })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'types_required',
            statusCode: 400,
            error: 'Bad Request',
            message: 'Types should has minimum one item',
          })
        );
      });
      it('should 400 if identificationMethods is set to [verifiable_presentation] and empty types is passed', async () => {
        const payload = _.flow(_.omit(['tenantId']))(
          await newDisclosure({
            tenant,
            identificationMethods: ['verifiable_presentation'],
            types: [],
          })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'request_validation_failed',
            statusCode: 400,
            error: 'Bad Request',
            message: 'body/types must NOT have fewer than 1 items',
          })
        );
      });

      it('should create the disclosure', async () => {
        const payload = _.omit(
          ['tenantId'],
          await newDisclosure({
            tenant,
            identificationMethods: ['verifiable_presentation'],
          })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          ...payload,
          feed: false,
          deactivationDate: expect.any(String),
          identificationMethods: ['verifiable_presentation'],
          sendPushOnVerification: false,
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });

        const dbResult = await mongoDb()
          .collection('disclosures')
          .findOne({ _id: new ObjectId(response.json.id) });
        expect(dbResult).toEqual({
          ...payload,
          identificationMethods: ['verifiable_presentation'],
          sendPushOnVerification: false,
          feed: false,
          _id: new ObjectId(response.json.id),
          tenantId: new ObjectId(tenant._id),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
      });

      it('should allow duplicate issuing-identification', async () => {
        await persistDisclosure({
          tenant,
          vendorEndpoint: 'issuing-identification',
          identificationMethods: ['verifiable_presentation'],
          types: [
            { type: 'EmailV1.0' },
            { type: 'PhoneV1.0' },
            { type: 'IdDocumentV1.0' },
          ],
        });

        const payload = _.omit(
          ['tenantId'],
          await newDisclosure({
            tenant,
            vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
            types: [
              { type: 'EmailV1.0' },
              { type: 'PhoneV1.0' },
              { type: 'IdDocumentV1.0' },
            ],
          })
        );

        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          ...payload,
          deactivationDate: expect.any(String),
          identificationMethods: ['verifiable_presentation'],
          sendPushOnVerification: false,
          feed: false,
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });
      });

      it('should create an identity disclosure', async () => {
        const payload = _.omit(
          ['tenantId', 'deactivationDate'],
          await newDisclosure({
            tenant,
            vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
            configurationType: ConfigurationType.ISSUING,
            offerMode: 'preloaded',
            types: [
              { type: 'EmailV1.0' },
              { type: 'PhoneV1.0' },
              { type: 'IdDocumentV1.0' },
            ],
          })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload: {
            ...payload,
            setIssuingDefault: true,
          },
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          ...payload,
          identificationMethods: ['verifiable_presentation'],
          sendPushOnVerification: false,
          feed: false,
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });

        const dbResult = await mongoDb()
          .collection('disclosures')
          .findOne({ _id: new ObjectId(response.json.id) });
        expect(dbResult).toEqual({
          ...payload,
          identificationMethods: ['verifiable_presentation'],
          sendPushOnVerification: false,
          feed: false,
          _id: new ObjectId(response.json.id),
          tenantId: new ObjectId(tenant._id),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
      });

      it('should create an disclosure if configuration type is not specified', async () => {
        fastify.overrides.reqConfig = (config) => ({
          ...config,
          disclosureCredentialTypeRequired: false,
        });
        const payload = _.omit(
          ['tenantId', 'configurationType'],
          await newDisclosure({
            tenant,
            vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
            identificationMethods: ['verifiable_presentation'],
            offerMode: 'preloaded',
            types: [
              { type: 'EmailV1.0' },
              { type: 'PhoneV1.0' },
              { type: 'IdDocumentV1.0' },
            ],
          })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload: {
            ...payload,
            setIssuingDefault: true,
          },
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          ...payload,
          deactivationDate: expect.any(String),
          configurationType: ConfigurationType.ISSUING,
          identificationMethods: ['verifiable_presentation'],
          feed: false,
          sendPushOnVerification: false,
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });

        const dbResult = await mongoDb()
          .collection('disclosures')
          .findOne({ _id: new ObjectId(response.json.id) });
        expect(dbResult).toEqual({
          ...payload,
          configurationType: ConfigurationType.ISSUING,
          identificationMethods: ['verifiable_presentation'],
          sendPushOnVerification: false,
          feed: false,
          _id: new ObjectId(response.json.id),
          tenantId: new ObjectId(tenant._id),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
      });

      it('should create an disclosure and should update a tenant (defaultIssuingDisclosureId)', async () => {
        fastify.overrides.reqConfig = (config) => ({
          ...config,
          disclosureCredentialTypeRequired: false,
        });
        const payload = _.omit(
          ['tenantId', 'configurationType'],
          await newDisclosure({
            tenant,
            vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
            offerMode: 'preloaded',
            types: [
              { type: 'EmailV1.0' },
              { type: 'PhoneV1.0' },
              { type: 'IdDocumentV1.0' },
            ],
          })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload: {
            ...payload,
            setIssuingDefault: true,
          },
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          ...payload,
          deactivationDate: expect.any(String),
          configurationType: ConfigurationType.ISSUING,
          identificationMethods: ['verifiable_presentation'],
          sendPushOnVerification: false,
          feed: false,
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });

        const dbResult = await mongoDb()
          .collection('tenants')
          .findOne({ _id: new ObjectId(tenant._id) });
        expect(dbResult.defaultIssuingDisclosureId.toString()).toStrictEqual(
          response.json.id.toString()
        );
      });

      it('should create an disclosure and should not update a tenant (defaultIssuingDisclosureId) if `setIssuingDefault` is false', async () => {
        fastify.overrides.reqConfig = (config) => ({
          ...config,
          disclosureCredentialTypeRequired: false,
        });
        tenant = await persistTenant({
          defaultIssuingDisclosureId: 'abc',
        });
        nockVerifiedProfile(tenant.did);
        const payload = _.omit(
          ['tenantId', 'configurationType'],
          await newDisclosure({
            tenant,
            vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
            offerMode: 'preloaded',
            types: [
              { type: 'EmailV1.0' },
              { type: 'PhoneV1.0' },
              { type: 'IdDocumentV1.0' },
            ],
          })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload: {
            ...payload,
            setIssuingDefault: false,
          },
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          ...payload,
          deactivationDate: expect.any(String),
          configurationType: ConfigurationType.ISSUING,
          identificationMethods: ['verifiable_presentation'],
          sendPushOnVerification: false,
          feed: false,
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });

        const dbResult = await mongoDb()
          .collection('tenants')
          .findOne({ _id: new ObjectId(tenant._id) });
        expect(dbResult.defaultIssuingDisclosureId).toStrictEqual('abc');
      });

      it('should 200 and create the disclosure with identificationMethods set to [verifiable_presentation]', async () => {
        const payload = _.flow(_.omit(['tenantId']))(
          await newDisclosure({
            tenant,
            identificationMethods: ['verifiable_presentation'],
          })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          ...payload,
          deactivationDate: expect.any(String),
          identificationMethods: ['verifiable_presentation'],
          sendPushOnVerification: false,
          feed: false,
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });

        const dbResult = await mongoDb()
          .collection('disclosures')
          .findOne({ _id: new ObjectId(response.json.id) });
        expect(dbResult).toEqual({
          ...payload,
          identificationMethods: ['verifiable_presentation'],
          sendPushOnVerification: false,
          feed: false,
          _id: new ObjectId(response.json.id),
          tenantId: new ObjectId(tenant._id),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
      });
    });

    describe('Create Disclosure - Issuing + VP Identification Method + Integrated Issuing Identification', () => {
      it('should 400 and fail to create an integrated identity disclosure without "identityMatchers"', async () => {
        const payload = _.omit(
          ['tenantId'],
          await newDisclosure({
            tenant,
            vendorEndpoint: VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION,
            configurationType: ConfigurationType.ISSUING,
            setIssuingDefault: true,
          })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'request_validation_failed',
            message:
              'When using { "vendorEndpoint": "integrated-issuing-identification" } "identityMatchers" property is required',
            statusCode: 400,
          })
        );
      });

      it('should create an integrated identity disclosure with sendPushOnVerification true', async () => {
        const payload = _.omit(
          ['tenantId'],
          await newDisclosure({
            tenant,
            vendorEndpoint: VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION,
            configurationType: ConfigurationType.ISSUING,
            offerMode: 'preloaded',
            types: [{ type: 'EmailV1.0' }],
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
          })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload: {
            ...payload,
            setIssuingDefault: true,
            sendPushOnVerification: true,
          },
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          ...payload,
          deactivationDate: expect.any(String),
          identificationMethods: ['verifiable_presentation'],
          sendPushOnVerification: true,
          feed: false,
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });

        const dbResult = await mongoDb()
          .collection('disclosures')
          .findOne({ _id: new ObjectId(response.json.id) });
        expect(dbResult).toEqual({
          ...payload,
          identificationMethods: ['verifiable_presentation'],
          sendPushOnVerification: true,
          feed: false,
          _id: new ObjectId(response.json.id),
          tenantId: new ObjectId(tenant._id),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
      });

      it('should create an integrated identity disclosure', async () => {
        const payload = _.omit(
          ['tenantId'],
          await newDisclosure({
            tenant,
            vendorEndpoint: VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION,
            configurationType: ConfigurationType.ISSUING,
            types: [{ type: 'EmailV1.0' }],
            offerMode: 'preloaded',
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
          })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload: {
            ...payload,
            setIssuingDefault: true,
          },
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          ...payload,
          deactivationDate: expect.any(String),
          identificationMethods: ['verifiable_presentation'],
          sendPushOnVerification: false,
          feed: false,
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });

        const dbResult = await mongoDb()
          .collection('disclosures')
          .findOne({ _id: new ObjectId(response.json.id) });
        expect(dbResult).toEqual({
          ...payload,
          identificationMethods: ['verifiable_presentation'],
          sendPushOnVerification: false,
          feed: false,
          _id: new ObjectId(response.json.id),
          tenantId: new ObjectId(tenant._id),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
      });
    });

    describe('Create Disclosure - Issuing + Preauth Identification Method', () => {
      it('should 400 when identification methods has preauth and disclosure is default', async () => {
        const payload = _.omit(
          ['tenantId'],
          await newDisclosure({
            tenant,
            configurationType: ConfigurationType.ISSUING,
            identificationMethods: ['preauth'],
            vendorEndpoint: 'issuing-identification',
            setIssuingDefault: true,
            offerMode: 'preloaded',
          })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'request_validation_failed',
            message:
              "body may not have property 'setIssuingDefault' when 'identificationMode' is set to 'preauth'",
            statusCode: 400,
          })
        );
      });

      it('should 400 if identificationMethods is set to [preauth] and types is passed', async () => {
        const payload = _.flow(_.omit(['tenantId']))(
          await newDisclosure({
            tenant,
            identificationMethods: ['preauth'],
            types: [{ type: 'PastEmploymentPosition' }],
          })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'request_validation_failed',
            statusCode: 400,
            error: 'Bad Request',
            message:
              "body may not have property 'types' when 'identificationMode' is set to 'preauth'",
          })
        );
      });

      it('should 200 and create the disclosure with identificationMethods set to [preauth]', async () => {
        tenant = await persistTenant({
          defaultIssuingDisclosureId: new ObjectId(),
        });
        nockVerifiedProfile(tenant.did);
        const payload = _.flow(_.omit(['tenantId']))(
          await newDisclosure({
            tenant,
            identificationMethods: ['preauth'],
            configurationType: ConfigurationType.ISSUING,
            vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
            offerMode: 'preloaded',
          })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          ..._.omit(['setIssuingDefault'])(payload),
          deactivationDate: expect.any(String),
          identificationMethods: ['preauth'],
          sendPushOnVerification: false,
          feed: false,
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });

        const dbResult = await mongoDb()
          .collection('disclosures')
          .findOne({ _id: new ObjectId(response.json.id) });
        expect(dbResult).toEqual({
          ..._.omit(['setIssuingDefault'])(payload),
          identificationMethods: ['preauth'],
          sendPushOnVerification: false,
          feed: false,
          _id: new ObjectId(response.json.id),
          tenantId: new ObjectId(tenant._id),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
      });

      it('should 200 if none of purpose, duration or types not sent', async () => {
        tenant = await persistTenant({
          defaultIssuingDisclosureId: new ObjectId(),
        });
        nockVerifiedProfile(tenant.did);
        const payload = _.flow(
          _.omit(['tenantId', 'purpose', 'duration', 'types'])
        )(
          await newDisclosure({
            tenant,
            identificationMethods: ['preauth'],
            configurationType: ConfigurationType.ISSUING,
            vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
            offerMode: 'preloaded',
          })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          ..._.omit(['setIssuingDefault'])(payload),
          deactivationDate: expect.any(String),
          identificationMethods: ['preauth'],
          sendPushOnVerification: false,
          feed: false,
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });

        const dbResult = await mongoDb()
          .collection('disclosures')
          .findOne({ _id: new ObjectId(response.json.id) });
        expect(dbResult).toEqual({
          ..._.omit(['setIssuingDefault'])(payload),
          identificationMethods: ['preauth'],
          sendPushOnVerification: false,
          feed: false,
          _id: new ObjectId(response.json.id),
          tenantId: new ObjectId(tenant._id),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
      });

      it('should 200 if tenant does not have default disclosure and create first issuing disclosure', async () => {
        tenant = await persistTenant({
          defaultIssuingDisclosureId: null,
        });
        nockVerifiedProfile(tenant.did);
        const payload = _.flow(_.omit(['tenantId']))(
          await newDisclosure({
            tenant,
            identificationMethods: ['preauth'],
            configurationType: ConfigurationType.ISSUING,
            vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
            offerMode: 'webhook',
            termsUrl:
              'https://www.velocityexperiencecenter.com/terms-and-conditions-vnf',
          })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          ..._.omit(['setIssuingDefault'])(payload),
          deactivationDate: expect.any(String),
          identificationMethods: ['preauth'],
          sendPushOnVerification: false,
          feed: false,
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });

        const dbResult = await mongoDb()
          .collection('disclosures')
          .findOne({ _id: new ObjectId(response.json.id) });
        expect(dbResult).toEqual({
          ..._.omit(['setIssuingDefault'])(payload),
          identificationMethods: ['preauth'],
          sendPushOnVerification: false,
          feed: false,
          _id: new ObjectId(response.json.id),
          tenantId: new ObjectId(tenant._id),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
      });
    });

    describe('Create Disclosure - Presentation Definition', () => {
      it('should 400 when presentationDefinition and types are present', async () => {
        const payload = {
          ..._.omit(['tenantId'], await newDisclosure({ tenant })),
          presentationDefinition: samplePresentationDefinition,
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'request_validation_failed',
            message:
              "body may only have one property of 'types' or 'presentationDefinition'",
            statusCode: 400,
          })
        );
      });

      it('should 400 when presentationDefinition.input_descriptors is empty', async () => {
        const presentationDefinition = {
          ...samplePresentationDefinition,
          input_descriptors: [],
        };
        const payload = {
          ..._.omit(
            ['tenantId'],
            await newDisclosure({
              tenant,
              presentationDefinition,
            })
          ),
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'request_validation_failed',
            message:
              // eslint-disable-next-line max-len
              'body/presentationDefinition/input_descriptors must NOT have fewer than 1 items',
            statusCode: 400,
          })
        );
      });

      it('should 400 when presentationDefinition.input_descriptors.*.group is missing/empty and submission_requirements is non-empty', async () => {
        const inputDescriptors = _.map(
          _.omit(['group']),
          samplePresentationDefinition.input_descriptors
        );
        const presentationDefinition = {
          input_descriptors: inputDescriptors,
          submission_requirements:
            samplePresentationDefinition.submission_requirements,
        };
        const payload = {
          ..._.omit(
            ['tenantId'],
            await newDisclosure({
              tenant,
              presentationDefinition,
            })
          ),
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'request_validation_failed',
            message:
              // eslint-disable-next-line max-len
              'presentationDefinition input_descriptors[*].group is required when submission_requirements are sent',
            statusCode: 400,
          })
        );
      });

      it('should 400 when submission_requirements.*.rule is missing', async () => {
        const submissionRequirements = _.map(
          _.omit(['rule']),
          samplePresentationDefinition.submission_requirements
        );
        const presentationDefinition = {
          input_descriptors: samplePresentationDefinition.input_descriptors,
          submission_requirements: submissionRequirements,
        };
        const payload = {
          ..._.omit(
            ['tenantId'],
            await newDisclosure({
              tenant,
              presentationDefinition,
            })
          ),
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'request_validation_failed',
            message:
              "body/presentationDefinition/submission_requirements/0 must have required property 'rule'",
            statusCode: 400,
          })
        );
      });

      it('should 400 when submission_requirements.*.from is missing', async () => {
        const submissionRequirements = _.map(
          _.omit(['from']),
          samplePresentationDefinition.submission_requirements
        );
        const presentationDefinition = {
          input_descriptors: samplePresentationDefinition.input_descriptors,
          submission_requirements: submissionRequirements,
        };
        const payload = {
          ..._.omit(
            ['tenantId'],
            await newDisclosure({
              tenant,
              presentationDefinition,
            })
          ),
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'request_validation_failed',
            message:
              // eslint-disable-next-line max-len
              "body/presentationDefinition/submission_requirements/0 must have required property 'from'",
            statusCode: 400,
          })
        );
      });

      it('should 200 and strip presentationDefinition.foo property', async () => {
        const presentationDefinition = {
          ...samplePresentationDefinition,
          foo: 'foo',
        };
        const payload = {
          ..._.omit(
            ['tenantId'],
            await newDisclosure({
              tenant,
              presentationDefinition,
            })
          ),
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          ..._.omit(['presentationDefinition.foo'], payload),
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          identificationMethods: ['verifiable_presentation'],
          feed: false,
          deactivationDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });
      });

      it('should 200 and strip presentationDefinition.id when present', async () => {
        const presentationDefinition = {
          ...samplePresentationDefinition,
          id: 'fooId',
        };
        const payload = {
          ..._.omit(
            ['tenantId'],
            await newDisclosure({
              tenant,
              presentationDefinition,
            })
          ),
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          ..._.omit(['presentationDefinition.id'], payload),
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          identificationMethods: ['verifiable_presentation'],
          feed: false,
          deactivationDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });
      });

      it('should 200 and strip presentationDefinition.format when present', async () => {
        const presentationDefinition = {
          ...samplePresentationDefinition,
          format: 'format',
        };
        const payload = {
          ..._.omit(
            ['tenantId'],
            await newDisclosure({
              tenant,
              presentationDefinition,
            })
          ),
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          ..._.omit(['presentationDefinition.format'], payload),
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          identificationMethods: ['verifiable_presentation'],
          feed: false,
          deactivationDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });
      });

      it('should 200 and strip input_descriptors.*.foo property', async () => {
        const presentationDefinition = {
          ...samplePresentationDefinition,
          input_descriptors: _.map(
            _.set('foo', 'foo'),
            samplePresentationDefinition.input_descriptors
          ),
        };
        const payload = {
          ..._.omit(
            ['tenantId'],
            await newDisclosure({
              tenant,
              presentationDefinition,
            })
          ),
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          ..._.omit(
            [
              'presentationDefinition.input_descriptors[0].foo',
              'presentationDefinition.input_descriptors[1].foo',
              'presentationDefinition.input_descriptors[2].foo',
            ],
            payload
          ),
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          identificationMethods: ['verifiable_presentation'],
          feed: false,
          deactivationDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });
      });

      it('should 200 and strip presentationDefinition.input_descriptors.*.format when present', async () => {
        const presentationDefinition = {
          ...samplePresentationDefinition,
          input_descriptors: _.map(
            _.set('format', 'fooFormat'),
            samplePresentationDefinition.input_descriptors
          ),
        };
        const payload = {
          ..._.omit(
            ['tenantId'],
            await newDisclosure({
              tenant,
              presentationDefinition,
            })
          ),
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          ..._.omit(
            [
              'presentationDefinition.input_descriptors[0].format',
              'presentationDefinition.input_descriptors[1].format',
              'presentationDefinition.input_descriptors[2].format',
            ],
            payload
          ),
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          identificationMethods: ['verifiable_presentation'],
          feed: false,
          deactivationDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });
      });

      it('should 200 and allow empty submission_requirements', async () => {
        const presentationDefinition = {
          ...samplePresentationDefinition,
          submission_requirements: [],
        };
        const payload = {
          ..._.omit(
            ['tenantId'],
            await newDisclosure({
              tenant,
              presentationDefinition,
            })
          ),
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          ..._.omit(
            ['presentationDefinition.submission_requirements[0].foo'],
            payload
          ),
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          identificationMethods: ['verifiable_presentation'],
          feed: false,
          deactivationDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });
      });

      it('should 200 and if submission_requirements is not supplied', async () => {
        const presentationDefinition = {
          ..._.omit(['submission_requirements'], samplePresentationDefinition),
        };
        const payload = {
          ..._.omit(
            ['tenantId'],
            await newDisclosure({
              tenant,
              presentationDefinition,
            })
          ),
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          ..._.omit(
            ['presentationDefinition.submission_requirements[0].foo'],
            payload
          ),
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          identificationMethods: ['verifiable_presentation'],
          feed: false,
          deactivationDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });
      });

      it('should 200 and strip submission_requirements.*.foo property', async () => {
        const presentationDefinition = {
          ...samplePresentationDefinition,
          submission_requirements: _.map(
            _.set('foo', 'foo'),
            samplePresentationDefinition.submission_requirements
          ),
        };
        const payload = {
          ..._.omit(
            ['tenantId'],
            await newDisclosure({
              tenant,
              presentationDefinition,
            })
          ),
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          ..._.omit(
            ['presentationDefinition.submission_requirements[0].foo'],
            payload
          ),
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          identificationMethods: ['verifiable_presentation'],
          feed: false,
          deactivationDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });
      });

      it('should 200 and strip submission_requirements.*.from_nested property', async () => {
        const presentationDefinition = {
          ...samplePresentationDefinition,
          submission_requirements: _.map(
            _.set('from_nested', 'foo'),
            samplePresentationDefinition.submission_requirements
          ),
        };
        const payload = {
          ..._.omit(
            ['tenantId'],
            await newDisclosure({
              tenant,
              presentationDefinition,
            })
          ),
        };
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(201);
        expect(response.json).toEqual({
          ..._.omit(
            ['presentationDefinition.submission_requirements[0].from_nested'],
            payload
          ),
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          identificationMethods: ['verifiable_presentation'],
          feed: false,
          deactivationDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });
      });
    });

    it('should create the disclosure', async () => {
      const payload = _.omit(['tenantId'], await newDisclosure({ tenant }));
      const response = await fastify.injectJson({
        method: 'POST',
        url: `${disclosureUrl(tenant)}`,
        payload: {
          ...payload,
          authTokensExpireIn: 1440,
        },
        headers: {
          authorization: `Bearer ${testAuthToken}`,
        },
      });

      expect(response.statusCode).toEqual(201);
      expect(response.json.authTokensExpireIn).toEqual(1440);

      const dbResult = await mongoDb()
        .collection('disclosures')
        .findOne({ _id: new ObjectId(response.json.id) });
      expect(dbResult.authTokensExpireIn).toEqual(1440);
    });
  });

  describe('Disclosure Update Test Suite', () => {
    describe('Update Disclosure - Common Missing Required Properties', () => {
      it('should 404 if tenant doesnt match', async () => {
        const updatePayload = {
          ..._.omit(['createdAt', 'updatedAt', '_id'], disclosures.a),
          description: 'update test',
        };
        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(altTenant)}/${disclosures.a._id}`,
          payload: updatePayload,
        });
        expect(response.statusCode).toEqual(404);
      });

      it('should 404 and not update if not found error', async () => {
        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${new ObjectId()}`,
          payload: await newDisclosure(),
        });
        expect(response.statusCode).toEqual(404);
      });

      it('should 400 with invalid configuration type', async () => {
        const updatePayload = {
          ..._.omit(
            [
              'createdAt',
              'updatedAt',
              '_id',
              'configurationType',
              'vendorEndpoint',
            ],
            disclosures.a
          ),
          vendorEndpoint: VendorEndpoint.RECEIVE_APPLICANT,
          configurationType: ConfigurationType.ISSUING,
        };

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${disclosures.a._id}`,
          payload: updatePayload,
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'disclosure_invalid',
            message: 'Disclosure configuration type invalid',
            statusCode: 400,
          })
        );
      });
    });

    describe('Update Disclosure - Issuing Missing Required Properties', () => {
      it('should 400 with invalid offermode', async () => {
        const updatePayload = {
          ..._.omit(['createdAt', 'updatedAt', '_id'], disclosures.a),
          offerMode: 'blabla',
        };

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${disclosures.a._id}`,
          payload: updatePayload,
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'request_validation_failed',
            message:
              'body/offerMode must be equal to one of the allowed values',
            statusCode: 400,
          })
        );
      });

      it('should 400 when default disclosure type mismatch', async () => {
        const payload = _.omit(
          ['tenantId'],
          await persistDisclosure({
            tenant,
          })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload: {
            ...payload,
            setIssuingDefault: true,
          },
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'issuing_default_not_compatible',
            message: 'The default disclosure cannot be of type "inspection"',
            statusCode: 400,
          })
        );
      });

      it('should 400 when default disclosure not set', async () => {
        const payload = _.omit(
          ['tenantId'],
          await newDisclosure({
            tenant,
            configurationType: ConfigurationType.INSPECTION,
            vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
            offerMode: 'preloaded',
          })
        );
        const response = await fastify.injectJson({
          method: 'POST',
          url: `${disclosureUrl(tenant)}`,
          payload: {
            ...payload,
            configurationType: ConfigurationType.ISSUING,
            setIssuingDefault: false,
          },
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'first_issuing_configuration_must_be_default',
            message:
              'The first "issuing" configuration created must be set as the default.',
            statusCode: 400,
          })
        );
      });

      it('should 400 when commercial entity does not match', async () => {
        const disclosure = await persistDisclosure({
          tenant,
          configurationType: ConfigurationType.ISSUING,
          vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
          offerMode: 'preloaded',
          commercialEntityLogo,
          commercialEntityName,
        });
        const updatePayload = {
          ..._.omit(['createdAt', 'updatedAt', '_id'], disclosure),
          commercialEntityLogo: 'https://www.xyz.com',
        };

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${disclosure._id}`,
          payload: {
            ...updatePayload,
            setIssuingDefault: true,
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'invalid_commercial_entity',
            message: 'Invalid commercial entity',
            statusCode: 400,
          })
        );
        expect(nockVP.isDone()).toBeTruthy();
      });

      it('should update a disclosure with and set default disclosure to tenant', async () => {
        const disclosure = await persistDisclosure({
          tenant,
          configurationType: ConfigurationType.ISSUING,
          vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
          offerMode: 'preloaded',
        });
        const updatePayload = {
          ..._.omit(['createdAt', 'updatedAt', '_id', 'feed'], disclosure),
          description: 'update test',
        };

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${disclosure._id}`,
          payload: {
            ...updatePayload,
            setIssuingDefault: true,
          },
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          identificationMethods: ['verifiable_presentation'],
          feed: false,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
          ...updatePayload,
        });

        const tenantDb = await tenantRepo.findOne({
          filter: {
            _id: new ObjectId(tenant._id),
          },
        });

        expect(tenantDb.defaultIssuingDisclosureId.toString()).toEqual(
          disclosure._id
        );
      });

      it('should update a disclosure commercial entity info', async () => {
        nock.cleanAll();
        const disclosure = await persistDisclosure({
          tenant,
          configurationType: ConfigurationType.ISSUING,
          vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
          offerMode: 'preloaded',
          commercialEntityLogo: 'https://www.abc.com',
          commercialEntityName: 'ABC',
        });
        const updatePayload = {
          ..._.omit(['createdAt', 'updatedAt', '_id'], disclosure),
          commercialEntityLogo: 'https://www.xyz.com',
          commercialEntityName: 'XYZ',
        };

        nockVP = nockVerifiedProfile(tenant.did, {
          credentialSubject: {
            commercialEntities: [
              {
                logo: 'https://www.abc.com',
                name: 'ABC',
              },
              {
                logo: 'https://www.xyz.com',
                name: 'XYZ',
              },
            ],
          },
        });

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${disclosure._id}`,
          payload: {
            ...updatePayload,
            setIssuingDefault: true,
          },
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          identificationMethods: ['verifiable_presentation'],
          feed: false,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
          ...updatePayload,
          commercialEntityLogo: 'https://www.xyz.com',
          commercialEntityName: 'XYZ',
        });
        expect(nockVP.isDone()).toBeTruthy();
      });

      it('should update a disclosure commercial entity info using cache', async () => {
        nock.cleanAll();
        const disclosure = await persistDisclosure({
          tenant,
          configurationType: ConfigurationType.ISSUING,
          vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
          offerMode: 'preloaded',
          commercialEntityLogo: 'https://www.abc.com',
          commercialEntityName: 'ABC',
        });
        const updatePayload = {
          ..._.omit(['createdAt', 'updatedAt', '_id'], disclosure),
          commercialEntityLogo: 'https://www.xyz.com',
          commercialEntityName: 'XYZ',
        };

        // nock verified profile to return commercial entities only once
        nockVP = nock('http://oracle.localhost.test')
          .get(
            `/api/v0.6/organizations/${encodeURIComponent(
              tenant.did
            )}/verified-profile`
          )
          .reply(
            200,
            {
              credentialSubject: {
                commercialEntities: [
                  {
                    logo: 'https://www.abc.com',
                    name: 'ABC',
                  },
                  {
                    logo: 'https://www.fyn.com',
                    name: 'FYN',
                  },
                  {
                    logo: 'https://www.xyz.com',
                    name: 'XYZ',
                  },
                ],
              },
            },
            { 'cache-control': 'max-age=60' }
          );

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${disclosure._id}`,
          payload: {
            ...updatePayload,
            setIssuingDefault: true,
          },
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          identificationMethods: ['verifiable_presentation'],
          feed: false,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
          ...updatePayload,
          commercialEntityLogo: 'https://www.xyz.com',
          commercialEntityName: 'XYZ',
        });

        const response2 = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${disclosure._id}`,
          payload: {
            ...updatePayload,
            commercialEntityLogo: 'https://www.fyn.com',
            commercialEntityName: 'FYN',
            setIssuingDefault: true,
          },
        });
        expect(response2.statusCode).toEqual(200);
        expect(response2.json).toEqual({
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          identificationMethods: ['verifiable_presentation'],
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
          feed: false,
          ...updatePayload,
          commercialEntityLogo: 'https://www.fyn.com',
          commercialEntityName: 'FYN',
        });

        expect(nockVP.pendingMocks()).toEqual([]);
      });

      it('should update a disclosure', async () => {
        fastify.overrides.reqConfig = (config) => ({
          ...config,
          disclosureCredentialTypeRequired: false,
        });
        const updatePayload = {
          ..._.omit(
            ['createdAt', 'updatedAt', '_id', 'configurationType'],
            disclosures.a
          ),
          description: 'update test',
        };
        const updatedDate = disclosures.a.updatedAt;
        expect(updatedDate).toBeDefined();

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${disclosures.a._id}`,
          payload: updatePayload,
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          identificationMethods: ['verifiable_presentation'],
          feed: false,
          createdAt: disclosures.a.createdAt,
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          configurationType: 'inspection',
          ...updatePayload,
        });
        expect(updatedDate).not.toEqual(response.json.updatedAt);
      });

      it('should not update a defaultIssuingDisclosureId for tenant if already updated', async () => {
        tenant = await persistTenant({
          defaultIssuingDisclosureId: new ObjectId(),
        });
        nockVerifiedProfile(tenant.did);
        const disclosure = await persistDisclosure({
          tenant,
          configurationType: ConfigurationType.ISSUING,
          vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
          offerMode: 'preloaded',
        });
        const updatePayload = {
          ..._.omit(['createdAt', 'updatedAt', '_id'], disclosure),
          description: 'update test',
        };

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${disclosure._id}`,
          payload: updatePayload,
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          identificationMethods: ['verifiable_presentation'],
          feed: false,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
          ...updatePayload,
        });

        const tenantDb = await tenantRepo.findOne({
          filter: {
            _id: new ObjectId(tenant._id),
          },
        });

        expect(tenantDb.defaultIssuingDisclosureId.toString()).toEqual(
          tenant.defaultIssuingDisclosureId.toString()
        );
      });

      it('should update a disclosure with offermode', async () => {
        const updatePayload = {
          ..._.omit(['createdAt', 'updatedAt', '_id'], disclosures.a),
          offerMode: 'preloaded',
        };

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${disclosures.a._id}`,
          payload: updatePayload,
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          identificationMethods: ['verifiable_presentation'],
          feed: false,
          createdAt: disclosures.a.createdAt,
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          ...updatePayload,
        });
      });

      it('should update a disclosure with `setIssuingDefault` and update tenant `defaultIssuingDisclosureId`', async () => {
        const disclosure1 = await persistDisclosure({
          tenant,
          configurationType: ConfigurationType.ISSUING,
          vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
        });
        await mongoDb()
          .collection('tenants')
          .updateOne(
            { _id: new ObjectId(tenant._id) },
            {
              $set: {
                defaultIssuingDisclosureId: new ObjectId(disclosure1._id),
              },
            }
          );
        const disclosure2 = await persistDisclosure({
          tenant,
          configurationType: ConfigurationType.ISSUING,
          vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
          offerMode: 'preloaded',
        });
        const updatePayload = {
          ..._.omit(['createdAt', 'updatedAt', '_id'], disclosure2),
          description: 'update test 2',
        };
        const tenantDb1 = await tenantRepo.findOne({
          filter: {
            _id: new ObjectId(tenant._id),
          },
        });
        expect(tenantDb1.defaultIssuingDisclosureId.toString()).toEqual(
          disclosure1._id
        );
        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${disclosure2._id}`,
          payload: {
            ...updatePayload,
            setIssuingDefault: true,
          },
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          identificationMethods: ['verifiable_presentation'],
          feed: false,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
          ...updatePayload,
        });

        const tenantDb2 = await tenantRepo.findOne({
          filter: {
            _id: new ObjectId(tenant._id),
          },
        });

        expect(tenantDb2.defaultIssuingDisclosureId.toString()).toEqual(
          disclosure2._id
        );
      });
    });

    describe('Update Disclosure - Inspection Configuration', () => {
      it('should 400 if identificationMethods is set to [verifiable_presentation] and types is not passed', async () => {
        const disclosure = await persistDisclosure({
          tenant,
          identificationMethods: ['verifiable_presentation'],
          configurationType: ConfigurationType.INSPECTION,
        });
        const updatePayload = _.flow(
          _.omit(['createdAt', 'updatedAt', '_id', 'types'])
        )(disclosure);

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${disclosures.a._id}`,
          payload: {
            ...updatePayload,
            types: [],
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'request_validation_failed',
            statusCode: 400,
            error: 'Bad Request',
            message: 'body/types must NOT have fewer than 1 items',
          })
        );
      });

      it('should 400 if identificationMethods is set to [verifiable_presentation] and empty types is passed', async () => {
        const updatePayload = _.flow(
          _.omit(['createdAt', 'updatedAt', '_id']),
          _.set('types', [])
        )(disclosures.a);

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${disclosures.a._id}`,
          payload: updatePayload,
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'request_validation_failed',
            statusCode: 400,
            error: 'Bad Request',
            message: 'body/types must NOT have fewer than 1 items',
          })
        );
      });

      it('should 400 when missing duration', async () => {
        const payload = _.omit(
          ['tenantId', 'duration'],
          await persistDisclosure({
            tenant,
            configurationType: ConfigurationType.INSPECTION,
            identificationMethods: ['verifiable_presentation'],
            vendorEndpoint: 'receive-applicant',
          })
        );
        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${payload._id}`,
          payload: {
            ...payload,
            duration: '',
          },
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'duration_required',
            message: 'Duration is required',
            statusCode: 400,
          })
        );
      });

      it('should 400 when missing purpose', async () => {
        const payload = _.omit(
          ['tenantId', 'purpose'],
          await persistDisclosure({
            tenant,
            configurationType: ConfigurationType.INSPECTION,
            vendorEndpoint: VendorEndpoint.RECEIVE_CHECKED_CREDENTIALS,
          })
        );
        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${payload._id}`,
          payload: {
            ...payload,
            purpose: '',
          },
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'purpose_required',
            message: 'Purpose is required',
            statusCode: 400,
          })
        );
      });

      it('should 400 when types is array of empty object', async () => {
        const payload = _.omit(
          ['tenantId', 'types'],
          await persistDisclosure({
            tenant,
            configurationType: ConfigurationType.INSPECTION,
            vendorEndpoint: VendorEndpoint.RECEIVE_CHECKED_CREDENTIALS,
          })
        );
        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${payload._id}`,
          payload: {
            ...payload,
            types: [{}],
          },
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'request_validation_failed',
            message: "body should have required property 'types'",
            statusCode: 400,
          })
        );
      });

      it('should 400 if the feed property is modified', async () => {
        const disclosure = await persistDisclosure({
          feed: true,
          tenant,
          configurationType: ConfigurationType.INSPECTION,
          vendorEndpoint: VendorEndpoint.RECEIVE_CHECKED_CREDENTIALS,
        });
        const updatePayload = _.flow(
          _.omit(['createdAt', 'updatedAt', '_id']),
          _.set('description', 'new description'),
          _.set('feed', false)
        )(disclosure);

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${disclosure._id}`,
          payload: updatePayload,
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'feed_property_cannot_be_modified',
            message: 'feed property cannot be modified',
            statusCode: 400,
          })
        );
      });

      it('should 200 and update the disclosure', async () => {
        const disclosure = await persistDisclosure({
          tenant,
          configurationType: ConfigurationType.INSPECTION,
          vendorEndpoint: VendorEndpoint.RECEIVE_CHECKED_CREDENTIALS,
        });

        const updatePayload = _.flow(
          _.omit(['createdAt', 'updatedAt', '_id']),
          _.set('description', 'new description')
        )(disclosure);

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${disclosure._id}`,
          payload: updatePayload,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          ..._.omit(['_id'], disclosure),
          ...updatePayload,
          id: disclosure._id,
          identificationMethods: ['verifiable_presentation'],
          feed: false,
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });

        const dbResult = await mongoDb()
          .collection('disclosures')
          .findOne({ _id: new ObjectId(response.json.id) });
        expect(mongoify(dbResult)).toEqual(
          mongoify({
            ...disclosure,
            ...updatePayload,
            tenantId: tenant._id,
            feed: false,
            identificationMethods: ['verifiable_presentation'],
            updatedAt: expect.any(Date),
          })
        );
      });

      it('should 200 and update the feed disclosure', async () => {
        const disclosure = await persistDisclosure({
          tenant,
          feed: true,
          configurationType: ConfigurationType.INSPECTION,
          vendorEndpoint: VendorEndpoint.RECEIVE_CHECKED_CREDENTIALS,
        });

        const updatePayload = _.flow(
          _.omit(['createdAt', 'updatedAt', '_id']),
          _.set('description', 'new description')
        )(disclosure);

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${disclosure._id}`,
          payload: updatePayload,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          ..._.omit(['_id'], disclosure),
          ...updatePayload,
          id: disclosure._id,
          identificationMethods: ['verifiable_presentation'],
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });

        const dbResult = await mongoDb()
          .collection('disclosures')
          .findOne({ _id: new ObjectId(response.json.id) });
        expect(mongoify(dbResult)).toEqual(
          mongoify({
            ...disclosure,
            ...updatePayload,
            tenantId: tenant._id,
            identificationMethods: ['verifiable_presentation'],
            updatedAt: expect.any(Date),
          })
        );
      });
    });

    describe('Update Disclosure - Issuing + VP Identification Method', () => {
      it('should 400 if identificationMethods is set to [verifiable_presentation] and types is not passed', async () => {
        const disclosure = await persistDisclosure({
          tenant,
          identificationMethods: ['verifiable_presentation'],
          configurationType: ConfigurationType.INSPECTION,
        });
        const updatePayload = _.flow(
          _.omit(['createdAt', 'updatedAt', '_id', 'types'])
        )(disclosure);

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${disclosures.a._id}`,
          payload: {
            ...updatePayload,
            types: [],
          },
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'request_validation_failed',
            statusCode: 400,
            error: 'Bad Request',
            message: 'body/types must NOT have fewer than 1 items',
          })
        );
      });

      it('should 400 if identificationMethods is set to [verifiable_presentation] and empty types is passed', async () => {
        const updatePayload = _.flow(
          _.omit(['createdAt', 'updatedAt', '_id']),
          _.set('types', [])
        )(disclosures.a);

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${disclosures.a._id}`,
          payload: updatePayload,
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'request_validation_failed',
            statusCode: 400,
            error: 'Bad Request',
            message: 'body/types must NOT have fewer than 1 items',
          })
        );
      });

      it('should 400 when missing duration', async () => {
        const payload = _.omit(
          ['tenantId', 'duration'],
          await persistDisclosure({
            tenant,
            configurationType: ConfigurationType.INSPECTION,
            identificationMethods: ['verifiable_presentation'],
            vendorEndpoint: 'receive-applicant',
          })
        );
        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${payload._id}`,
          payload: {
            ...payload,
            duration: '',
          },
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'duration_required',
            message: 'Duration is required',
            statusCode: 400,
          })
        );
      });

      it('should 400 when missing purpose', async () => {
        const payload = _.omit(
          ['tenantId', 'purpose'],
          await persistDisclosure({
            tenant,
            configurationType: ConfigurationType.INSPECTION,
            identificationMethods: ['verifiable_presentation'],
            vendorEndpoint: 'receive-applicant',
          })
        );
        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${payload._id}`,
          payload: {
            ...payload,
            purpose: '',
          },
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'purpose_required',
            message: 'Purpose is required',
            statusCode: 400,
          })
        );
      });

      it('should 400 when types is array of empty object', async () => {
        const payload = _.omit(
          ['tenantId', 'types'],
          await persistDisclosure({
            tenant,
            configurationType: ConfigurationType.INSPECTION,
            identificationMethods: ['verifiable_presentation'],
            vendorEndpoint: 'receive-applicant',
          })
        );
        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${payload._id}`,
          payload: {
            ...payload,
            types: [{}],
          },
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'request_validation_failed',
            message: "body should have required property 'types'",
            statusCode: 400,
          })
        );
      });

      it('should 200 and update the disclosure with identificationMethods set to [verifiable_presentation]', async () => {
        const updatePayload = _.flow(
          _.omit(['createdAt', 'updatedAt', '_id']),
          _.set('identificationMethods', ['verifiable_presentation'])
        )(disclosures.a);

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${disclosures.a._id}`,
          payload: updatePayload,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          ...updatePayload,
          identificationMethods: ['verifiable_presentation'],
          sendPushOnVerification: false,
          feed: false,
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });

        const dbResult = await mongoDb()
          .collection('disclosures')
          .findOne({ _id: new ObjectId(response.json.id) });
        expect(mongoify(dbResult)).toEqual({
          ...updatePayload,
          identificationMethods: ['verifiable_presentation'],
          feed: false,
          sendPushOnVerification: false,
          _id: new ObjectId(response.json.id),
          tenantId: new ObjectId(tenant._id),
          deactivationDate: expect.any(Date),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
      });
    });

    describe('Update Disclosure - Issuing + VP Identification Method + Integrated Issuing Identification', () => {
      it('should 400 and fail to create an integrated identity disclosure without "identityMatchers"', async () => {
        const payload = _.omit(
          ['tenantId'],
          await persistDisclosure({
            tenant,
            vendorEndpoint: VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION,
            configurationType: ConfigurationType.ISSUING,
            setIssuingDefault: true,
          })
        );
        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${payload._id}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'request_validation_failed',
            message:
              'When using { "vendorEndpoint": "integrated-issuing-identification" } "identityMatchers" property is required',
            statusCode: 400,
          })
        );
      });

      it('should create an integrated identity disclosure', async () => {
        const payload = _.omit(
          ['tenantId'],
          await persistDisclosure({
            tenant,
            vendorEndpoint: VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION,
            configurationType: ConfigurationType.ISSUING,
            types: [{ type: 'EmailV1.0' }],
            offerMode: 'preloaded',
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
          })
        );
        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${payload._id}`,
          payload: {
            ..._.omit(['_id', 'createdAt', 'updatedAt'], payload),
            types: [{ type: 'EmailV1.0' }, { type: 'PhoneV1.0' }],
          },
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          ..._.omit(['_id'], payload),
          deactivationDate: expect.any(String),
          identificationMethods: ['verifiable_presentation'],
          sendPushOnVerification: false,
          feed: false,
          types: [{ type: 'EmailV1.0' }, { type: 'PhoneV1.0' }],
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });

        const dbResult = await mongoDb()
          .collection('disclosures')
          .findOne({ _id: new ObjectId(response.json.id) });
        expect(mongoify(dbResult)).toEqual({
          ..._.omit(['_id'], payload),
          identificationMethods: ['verifiable_presentation'],
          sendPushOnVerification: false,
          feed: false,
          _id: new ObjectId(response.json.id),
          tenantId: new ObjectId(tenant._id),
          types: [{ type: 'EmailV1.0' }, { type: 'PhoneV1.0' }],
          deactivationDate: expect.any(Date),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
      });
    });

    describe('Update Disclosure - Issuing + Preauth Identification Method', () => {
      it('should 400 if identificationMethods is set to [preauth] and types is passed', async () => {
        const updatePayload = _.flow(
          _.omit(['createdAt', 'updatedAt', '_id']),
          _.set('types', []),
          _.set('identificationMethods', ['preauth'])
        )(disclosures.a);

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${disclosures.a._id}`,
          payload: updatePayload,
        });
        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'request_validation_failed',
            statusCode: 400,
            error: 'Bad Request',
            message: 'body/types must NOT have fewer than 1 items',
          })
        );
      });

      it('should 400 if identificationMethods is set to [preauth] and types is passed', async () => {
        const payload = _.flow(_.omit(['tenantId']))(
          await persistDisclosure({
            tenant,
            identificationMethods: ['preauth'],
          })
        );
        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${disclosures.a._id}`,
          payload: {
            ...payload,
            types: [{ type: 'PastEmploymentPosition' }],
          },
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            errorCode: 'request_validation_failed',
            statusCode: 400,
            error: 'Bad Request',
            message:
              "body may not have property 'types' when 'identificationMode' is set to 'preauth'",
          })
        );
      });

      it('should 400 when identification methods has preauth and disclosure is default', async () => {
        const payload = _.omit(
          ['tenantId', 'types'],
          await persistDisclosure({
            tenant,
            configurationType: ConfigurationType.ISSUING,
            identificationMethods: ['preauth'],
            vendorEndpoint: 'issuing-identification',
            offerMode: 'preloaded',
          })
        );
        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${payload._id}`,
          payload: {
            ...payload,
            setIssuingDefault: true,
          },
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'request_validation_failed',
            message:
              "body may not have property 'setIssuingDefault' when 'identificationMode' is set to 'preauth'",
            statusCode: 400,
          })
        );
      });

      it('should 200 and update the disclosure with identificationMethods set to [preauth]', async () => {
        const preauthDisclosure = await persistDisclosure({
          tenant,
          vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
          offerMode: 'preloaded',
          configurationType: ConfigurationType.ISSUING,
          identificationMethods: ['preauth'],
        });
        const updatePayload = _.flow(
          _.omit(['createdAt', 'updatedAt', '_id', 'types'])
        )(preauthDisclosure);

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${preauthDisclosure._id}`,
          payload: updatePayload,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          ...updatePayload,
          identificationMethods: ['preauth'],
          sendPushOnVerification: false,
          feed: false,
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });

        const dbResult = await mongoDb()
          .collection('disclosures')
          .findOne({ _id: new ObjectId(response.json.id) });
        expect(mongoify(dbResult)).toEqual({
          ...updatePayload,
          identificationMethods: ['preauth'],
          sendPushOnVerification: false,
          feed: false,
          _id: new ObjectId(response.json.id),
          tenantId: new ObjectId(tenant._id),
          deactivationDate: expect.any(Date),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
      });
    });

    describe('Update Disclosure - Presentation Definition', () => {
      it('should 400 when presentationDefinition and types are present', async () => {
        const disclosure = await persistDisclosure({
          tenant,
        });
        const payload = {
          ..._.omit(['_id', 'tenantId'], disclosure),
          presentationDefinition: samplePresentationDefinition,
        };
        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${disclosure._id}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'request_validation_failed',
            message:
              "body may only have one property of 'types' or 'presentationDefinition'",
            statusCode: 400,
          })
        );
      });

      it('should 200 and switch from types to presentationDefinition', async () => {
        const disclosure = await persistDisclosure({
          tenant,
        });
        const payload = {
          ..._.omit(['_id', 'tenantId', 'types'], disclosure),
          presentationDefinition: samplePresentationDefinition,
        };
        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${disclosure._id}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          ...payload,
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          identificationMethods: ['verifiable_presentation'],
          feed: false,
          deactivationDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });

        const updatedDisclosure = await mongoDb()
          .collection('disclosures')
          .findOne({ _id: new ObjectId(disclosure._id) });
        expect(mongoify(updatedDisclosure)).toEqual({
          ...payload,
          feed: false,
          _id: expect.any(ObjectId),
          tenantId: expect.any(ObjectId),
          identificationMethods: ['verifiable_presentation'],
          deactivationDate: expect.any(Date),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
        expect(updatedDisclosure.types).toBeUndefined();
      });

      it('should 200 and switch from presentationDefinition to types', async () => {
        const disclosure = await persistDisclosure({
          tenant,
          presentationDefinition: samplePresentationDefinition,
        });
        const payload = {
          ..._.omit(['_id', 'tenantId', 'presentationDefinition'], disclosure),
          types: [
            { type: 'PastEmploymentPosition' },
            { type: 'CurrentEmploymentPosition' },
          ],
        };
        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${disclosureUrl(tenant)}/${disclosure._id}`,
          payload,
          headers: {
            authorization: `Bearer ${testAuthToken}`,
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          ...payload,
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          identificationMethods: ['verifiable_presentation'],
          feed: false,
          deactivationDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });

        const updatedDisclosure = await mongoDb()
          .collection('disclosures')
          .findOne({ _id: new ObjectId(disclosure._id) });
        expect(mongoify(updatedDisclosure)).toEqual({
          ...payload,
          feed: false,
          _id: expect.any(ObjectId),
          tenantId: expect.any(ObjectId),
          identificationMethods: ['verifiable_presentation'],
          deactivationDate: expect.any(Date),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
        expect(updatedDisclosure.presentationDefinition).toBeUndefined();
      });
    });
  });

  describe('Disclosure Retrieval Test Suite', () => {
    it('should 404 for a missing but properly formatted disclosure id', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${disclosureUrl(tenant)}/${disclosures.c._id}`,
      });
      expect(response.statusCode).toEqual(404);
    });

    it('should 404 for a malformatted disclosure', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${disclosureUrl(tenant)}/abc`,
      });
      expect(response.statusCode).toEqual(404);
    });

    it('should get a particular disclosure with offerMode', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${disclosureUrl(tenant)}/${disclosures.d._id}`,
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        createdAt: expect.any(String),
        description: 'withoffermode',
        duration: '6y',
        id: expect.any(String),
        identificationMethods: ['verifiable_presentation'],
        offerMode: 'preloaded',
        purpose: 'Job Application',
        sendPushOnVerification: false,
        feed: false,
        termsUrl: 'https://www.lipsum.com/feed/html',
        types: [
          { type: 'PastEmploymentPosition' },
          { type: 'CurrentEmploymentPosition' },
        ],
        updatedAt: expect.any(String),
        vendorDisclosureId: 'HR-PKG-USPS-CLRK',
        vendorEndpoint: 'receive-applicant',
        configurationType: 'inspection',
        deactivationDate: expect.any(String),
        authTokensExpireIn: 10080,
      });
    });

    it('should get a particular disclosure', async () => {
      const disclosure = await persistDisclosure({
        tenant,
        presentationDefinition: samplePresentationDefinition,
        feed: true,
      });
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${disclosureUrl(tenant)}/${disclosure._id}`,
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        id: disclosure._id,
        identificationMethods: ['verifiable_presentation'],
        ..._.omit(['_id'], disclosure),
        feed: true,
      });
    });

    it('should not set disclosure as default for tenant if has only preauth identification method', async () => {
      await mongoDb().collection('disclosures').deleteMany({});

      const disclosure = await persistDisclosure({
        identificationMethods: ['preauth'],
        configurationType: 'issuing',
        offerMode: 'webhook',
        vendorEndpoint: 'issuing-identification',
        tenant,
      });

      expect(tenant.defaultIssuingDisclosureId).toBeUndefined();
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${disclosureUrl(tenant)}/${disclosure._id}`,
      });
      expect(response.statusCode).toEqual(200);

      const tenantDb = await tenantRepo.findOne({
        filter: {
          _id: new ObjectId(tenant._id),
        },
      });

      expect(tenantDb.defaultIssuingDisclosureId).toBeUndefined();
    });

    it('should set disclosure as default for tenant if has apart from preauth identification method', async () => {
      await mongoDb().collection('disclosures').deleteMany({});

      const disclosure = await persistDisclosure({
        identificationMethods: ['preauth', 'verifiable_presentation'],
        configurationType: 'issuing',
        offerMode: 'webhook',
        vendorEndpoint: 'issuing-identification',
        tenant,
      });

      expect(tenant.defaultIssuingDisclosureId).toBeUndefined();
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${disclosureUrl(tenant)}/${disclosure._id}`,
      });
      expect(response.statusCode).toEqual(200);

      const tenantDb = await tenantRepo.findOne({
        filter: {
          _id: new ObjectId(tenant._id),
        },
      });

      expect(tenantDb.defaultIssuingDisclosureId.toString()).toBe(
        disclosure._id.toString()
      );
    });

    it('should update disclosure configuration type', async () => {
      const disclosure = await mongoDb()
        .collection('disclosures')
        .insertOne({
          description: 'Clerk',
          types: [
            { type: 'PastEmploymentPosition' },
            { type: 'CurrentEmploymentPosition' },
          ],
          vendorEndpoint: VendorEndpoint.RECEIVE_APPLICANT,
          tenantId: new ObjectId(tenant._id),
          vendorDisclosureId: 'HR-PKG-USPS-CLRK',
          purpose: 'Job Application',
          duration: '6y',
          termsUrl: 'https://www.lipsum.com/feed/html',
          sendPushOnVerification: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${disclosureUrl(tenant)}/${disclosure.insertedId.toString()}`,
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json.id).toBe(disclosure.insertedId.toString());
      expect(response.json.configurationType).toEqual('inspection');
    });

    it('should get a disclosures by one vendor endpoint', async () => {
      const disclosure = await persistDisclosure({
        description: 've-test',
        vendorEndpoint: 'receive-applicant-789',
        tenant,
      });
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${disclosureUrl(tenant)}?vendorEndpoint=receive-applicant-789`,
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual([
        {
          id: disclosure._id,
          identificationMethods: ['verifiable_presentation'],
          feed: false,
          ..._.omit(['_id'], disclosure),
        },
      ]);
    });

    it('should get a disclosures by vendor endpoint list', async () => {
      const disclosure = await persistDisclosure({
        description: 've-test',
        vendorEndpoint: 'receive-applicant-789',
        tenant,
      });
      const disclosure2 = await persistDisclosure({
        description: 've-test',
        vendorEndpoint: 'mock',
        tenant,
      });
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${disclosureUrl(
          tenant
        )}?vendorEndpoint=receive-applicant-789&vendorEndpoint=mock`,
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json.length).toEqual(2);
      expect(response.json).toEqual(
        expect.arrayContaining([
          {
            id: disclosure2._id,
            identificationMethods: ['verifiable_presentation'],
            feed: false,
            ..._.omit(['_id'], disclosure2),
          },
          {
            id: disclosure._id,
            identificationMethods: ['verifiable_presentation'],
            feed: false,
            ..._.omit(['_id'], disclosure),
          },
        ])
      );
    });

    it('should get a particular disclosure without sendPushOnVerification', async () => {
      const oldFormatDisclosure = await persistDisclosure({
        tenant,
      });

      await mongoDb()
        .collection('disclosures')
        .updateOne(
          { _id: new ObjectId(oldFormatDisclosure._id) },
          { $unset: { sendPushOnVerification: '' } }
        );

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${disclosureUrl(tenant)}/${oldFormatDisclosure._id}`,
      });
      expect(response.statusCode).toEqual(200);

      expect(response.json).toEqual({
        id: oldFormatDisclosure._id,
        identificationMethods: ['verifiable_presentation'],
        feed: false,
        ..._.omit(['_id'], oldFormatDisclosure),
      });
    });

    it('should get many disclosures', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: `${disclosureUrl(tenant)}`,
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toStrictEqual(
        expect.arrayContaining([
          {
            id: disclosures.d._id,
            identificationMethods: ['verifiable_presentation'],
            feed: false,
            ..._.omit(['_id'], disclosures.d),
          },
          {
            id: disclosures.e._id,
            identificationMethods: ['verifiable_presentation'],
            feed: false,
            ..._.omit(['_id'], disclosures.e),
          },
        ])
      );
    });
  });

  describe('Disclosure QR code Test Suite', () => {
    it('should return a url for the qr-code', async () => {
      const payload = _.omit(['tenantId'], await newDisclosure({ tenant }));

      const createResponse = await fastify.injectJson({
        method: 'POST',
        url: `${disclosureUrl(tenant)}`,
        payload,
      });
      const urlEncodedDid = encodeURIComponent(tenant.did); // encodeURIComponent(tenant.did);

      const response = await fastify.inject({
        method: 'GET',
        url: `${disclosureUrl(tenant)}/${createResponse.json.id}/qrcode.uri`,
        headers: {
          authorization: `Bearer ${testAuthToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.body).toEqual(
        // eslint-disable-next-line max-len
        `velocity-test://inspect?request_uri=http%3A%2F%2Flocalhost.test%2Fapi%2Fholder%2Fv0.6%2Forg%2F${urlEncodedDid}%2Finspect%2Fget-presentation-request%3Fid%3D${createResponse.json.id}&inspectorDid=${urlEncodedDid}`
      );
    });

    it('should return a url for the qr-code with vendorOriginContext', async () => {
      const payload = _.omit(['tenantId'], await newDisclosure({ tenant }));
      const vendorOriginContext = 'abc123';

      const createResponse = await fastify.injectJson({
        method: 'POST',
        url: `${disclosureUrl(tenant)}`,
        payload,
      });

      const response = await fastify.inject({
        method: 'GET',
        url: `${disclosureUrl(tenant)}/${
          createResponse.json.id
        }/qrcode.uri?vendorOriginContext=${vendorOriginContext}`,
        headers: {
          authorization: `Bearer ${testAuthToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      const urlEncodedDid = encodeURIComponent(tenant.did);
      expect(response.body).toEqual(
        // eslint-disable-next-line max-len
        `velocity-test://inspect?request_uri=http%3A%2F%2Flocalhost.test%2Fapi%2Fholder%2Fv0.6%2Forg%2F${urlEncodedDid}%2Finspect%2Fget-presentation-request%3Fid%3D${createResponse.json.id}&inspectorDid=${urlEncodedDid}&vendorOriginContext=${vendorOriginContext}`
      );
    });

    it('should return a url for the qr-code for vendorEndpoint is `issuing-identification`', async () => {
      const payload = _.omit(
        ['tenantId'],
        await newDisclosure({
          tenant,
          vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
          configurationType: ConfigurationType.ISSUING,
          offerMode: 'preloaded',
        })
      );

      const createResponse = await fastify.injectJson({
        method: 'POST',
        url: `${disclosureUrl(tenant)}`,
        payload: {
          ...payload,
          setIssuingDefault: true,
        },
      });

      const response = await fastify.inject({
        method: 'GET',
        url: `${disclosureUrl(tenant)}/${createResponse.json.id}/qrcode.uri`,
        headers: {
          authorization: `Bearer ${testAuthToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      const urlEncodedDid = encodeURIComponent(tenant.did);
      expect(response.body).toEqual(
        // eslint-disable-next-line max-len
        `velocity-test://issue?request_uri=http%3A%2F%2Flocalhost.test%2Fapi%2Fholder%2Fv0.6%2Forg%2F${urlEncodedDid}%2Fissue%2Fget-credential-manifest%3Fid%3D${
          createResponse.json.id
        }&issuerDid=${encodeURIComponent(tenant.did)}`
      );
    });

    it('should return a url for the qr-code for vendorEndpoint is `issuing-identification` with vendorOriginContext', async () => {
      const payload = _.omit(
        ['tenantId'],
        await newDisclosure({
          tenant,
          vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
          configurationType: ConfigurationType.ISSUING,
          offerMode: 'preloaded',
        })
      );

      const createResponse = await fastify.injectJson({
        method: 'POST',
        url: `${disclosureUrl(tenant)}`,
        payload: {
          ...payload,
          setIssuingDefault: true,
        },
      });

      const response = await fastify.inject({
        method: 'GET',
        url: `${disclosureUrl(tenant)}/${
          createResponse.json.id
        }/qrcode.uri?vendorOriginContext=123`,
        headers: {
          authorization: `Bearer ${testAuthToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      const urlEncodedDid = encodeURIComponent(tenant.did);
      expect(response.body).toEqual(
        // eslint-disable-next-line max-len
        `velocity-test://issue?request_uri=http%3A%2F%2Flocalhost.test%2Fapi%2Fholder%2Fv0.6%2Forg%2F${urlEncodedDid}%2Fissue%2Fget-credential-manifest%3Fid%3D${
          createResponse.json.id
        }&issuerDid=${encodeURIComponent(tenant.did)}&vendorOriginContext=123`
      );
    });

    it('should return a url for the qr-code for vendorEndpoint is `integrated-issuing-identification`', async () => {
      const payload = _.omit(
        ['tenantId'],
        await newDisclosure({
          tenant,
          vendorEndpoint: VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION,
          configurationType: ConfigurationType.ISSUING,
          types: [{ type: 'EmailV1.0' }],
          offerMode: 'preloaded',
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
        })
      );

      const createResponse = await fastify.injectJson({
        method: 'POST',
        url: `${disclosureUrl(tenant)}`,
        payload: {
          ...payload,
          setIssuingDefault: true,
        },
      });

      const response = await fastify.inject({
        method: 'GET',
        url: `${disclosureUrl(tenant)}/${createResponse.json.id}/qrcode.uri`,
        headers: {
          authorization: `Bearer ${testAuthToken}`,
        },
      });

      expect(response.statusCode).toEqual(200);
      const urlEncodedDid = encodeURIComponent(tenant.did);
      expect(response.body).toEqual(
        // eslint-disable-next-line max-len
        `velocity-test://issue?request_uri=http%3A%2F%2Flocalhost.test%2Fapi%2Fholder%2Fv0.6%2Forg%2F${urlEncodedDid}%2Fissue%2Fget-credential-manifest%3Fid%3D${
          createResponse.json.id
        }&issuerDid=${encodeURIComponent(tenant.did)}`
      );
    });

    it('should return an image for the qr-code', async () => {
      const payload = _.omit(['tenantId'], await newDisclosure({ tenant }));

      const createResponse = await fastify.injectJson({
        method: 'POST',
        url: `${disclosureUrl(tenant)}`,
        payload,
      });

      const response = await fastify.inject({
        method: 'GET',
        url: `${disclosureUrl(tenant)}/${createResponse.json.id}/qrcode.png`,
        headers: {
          authorization: `Bearer ${testAuthToken}`,
        },
      });

      expect(response.headers['content-type']).toEqual('image/png');
      expect(response.statusCode).toEqual(200);
      expect(response.body.length).toBeGreaterThan(100);
    });
  });

  describe('Disclosure HTTP Deep Link Tests', () => {
    it('Should get a Disclosure HTTP Deep Link', async () => {
      const payload = await persistDisclosure({ tenant });
      const urlEncodedDid = encodeURIComponent(tenant.did);

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${disclosureUrl(tenant)}/${payload._id}/deep-link`,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        deepLink:
          // eslint-disable-next-line max-len
          `http://localhost.test/app-redirect?request_uri=http%3A%2F%2Flocalhost.test%2Fapi%2Fholder%2Fv0.6%2Forg%2F${urlEncodedDid}%2Finspect%2Fget-presentation-request%3Fid%3D${payload._id}&inspectorDid=${urlEncodedDid}&exchange_type=inspect`,
      });
    });

    it('Should generate a Disclosure HTTP Deep Link with vendor origin context', async () => {
      const payload = await persistDisclosure({ tenant });
      const urlEncodedDid = encodeURIComponent(tenant.did);

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${disclosureUrl(tenant)}/${
          payload._id
        }/deep-link?vendorOriginContext=123`,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        deepLink:
          // eslint-disable-next-line max-len
          `http://localhost.test/app-redirect?request_uri=http%3A%2F%2Flocalhost.test%2Fapi%2Fholder%2Fv0.6%2Forg%2F${urlEncodedDid}%2Finspect%2Fget-presentation-request%3Fid%3D${payload._id}&inspectorDid=${urlEncodedDid}&vendorOriginContext=123&exchange_type=inspect`,
      });
    });

    it('Should generate a Disclosure HTTP Deep Link for issuing', async () => {
      const payload = await persistDisclosure({
        tenant,
        vendorEndpoint: 'integrated-issuing-identification',
      });
      const urlEncodedDid = encodeURIComponent(tenant.did);

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${disclosureUrl(tenant)}/${payload._id}/deep-link`,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        deepLink:
          // eslint-disable-next-line max-len
          `http://localhost.test/app-redirect?request_uri=http%3A%2F%2Flocalhost.test%2Fapi%2Fholder%2Fv0.6%2Forg%2F${urlEncodedDid}%2Fissue%2Fget-credential-manifest%3Fid%3D${payload._id}&issuerDid=${urlEncodedDid}&exchange_type=issue`,
      });
    });

    it('Should generate a Disclosure HTTP Deep Link for issuing with vendorOriginContext', async () => {
      const payload = await persistDisclosure({
        tenant,
        vendorEndpoint: 'integrated-issuing-identification',
      });
      const urlEncodedDid = encodeURIComponent(tenant.did);

      const response = await fastify.injectJson({
        method: 'GET',
        url: `${disclosureUrl(tenant)}/${
          payload._id
        }/deep-link?vendorOriginContext=123`,
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        deepLink:
          // eslint-disable-next-line max-len
          `http://localhost.test/app-redirect?request_uri=http%3A%2F%2Flocalhost.test%2Fapi%2Fholder%2Fv0.6%2Forg%2F${urlEncodedDid}%2Fissue%2Fget-credential-manifest%3Fid%3D${payload._id}&issuerDid=${urlEncodedDid}&vendorOriginContext=123&exchange_type=issue`,
      });
    });
  });

  describe('Disclosure Deletion Test Suite', () => {
    it('should 404 and not delete if not found error', async () => {
      const response = await fastify.injectJson({
        method: 'DELETE',
        url: `${disclosureUrl(tenant)}/${new ObjectId()}`,
      });

      expect(response.statusCode).toEqual(404);
    });

    it('should 404 and not delete if wrong tenant found error', async () => {
      const response = await fastify.injectJson({
        method: 'DELETE',
        url: `${disclosureUrl(altTenant)}/${disclosures.a._id}`,
      });

      expect(response.statusCode).toEqual(404);

      const dbResult = await mongoDb()
        .collection('disclosures')
        .findOne({ _id: new ObjectId(disclosures.a._id) });
      expect(dbResult).toBeTruthy();
    });

    it('should 400 if disclosure linked to tenant', async () => {
      await tenantRepo.update(tenant._id, {
        defaultIssuingDisclosureId: new ObjectId(disclosures.a._id),
      });

      const response = await fastify.injectJson({
        method: 'DELETE',
        url: `${disclosureUrl(tenant)}/${disclosures.a._id}`,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          message: 'Disclosure cannot be deleted',
          statusCode: 400,
          errorCode: 'default_disclosure_cannot_be_deleted',
        })
      );

      expect(
        await mongoDb()
          .collection('disclosures')
          .countDocuments({
            _id: new ObjectId(disclosures.a._id),
          })
      ).toEqual(1);
    });

    it('should 400 if disclosure has feeds', async () => {
      await persistFeed({ tenant, disclosure: disclosures.a });
      const response = await fastify.injectJson({
        method: 'DELETE',
        url: `${disclosureUrl(tenant)}/${disclosures.a._id}`,
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          message: 'Disclosure cannot be deleted',
          statusCode: 400,
          errorCode: 'disclosure_with_feeds_cannot_be_deleted',
        })
      );

      expect(
        await mongoDb()
          .collection('disclosures')
          .countDocuments({
            _id: new ObjectId(disclosures.a._id),
          })
      ).toEqual(1);
    });

    it('should delete a disclosure', async () => {
      const response = await fastify.injectJson({
        method: 'DELETE',
        url: `${disclosureUrl(tenant)}/${disclosures.a._id}`,
      });

      expect(response.statusCode).toEqual(204);
      await expect(
        mongoDb()
          .collection('disclosures')
          .findOne({ _id: new ObjectId(disclosures.a._id) })
      ).resolves.toEqual(null);
    });
  });
});
