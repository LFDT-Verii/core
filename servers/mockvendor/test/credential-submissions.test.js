const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { ObjectId } = require('mongodb');
const { flow, map } = require('lodash/fp');
const {
  addDays,
  endOfDay,
  formatISOWithOptions,
  startOfDay,
  subDays,
} = require('date-fns/fp');
const {
  ISO_DATETIME_FORMAT,
  OBJECT_ID_FORMAT,
} = require('@verii/test-regexes');
const buildFastify = require('./helpers/mockvendor-build-fastify');
const adamSmithId = require('./helpers/legacy-Adam-Smith.json');
const seniorPM = require('./helpers/PastEmploymentPosition-2009-2015-Project-Manager.json');
const juniorPM = require('./helpers/PastEmploymentPosition-2007-2009-Junior-Project-Manager.json');

describe('Credential Submissions', () => {
  let fastify;
  let disclosureMetadata;
  let credentials;
  const credentialChecks = {
    TRUSTED_HOLDER: 'NOT_APPLICABLE',
    TRUSTED_ISSUER: 'SELF_SIGNED',
    UNEXPIRED: 'NOT_APPLICABLE',
    UNREVOKED: 'PASS',
    UNTAMPERED: 'PASS',
  };

  const prepareCredentialsApiResponse = map((c) => ({
    ...c,
    ...disclosureMetadata,
    id: expect.stringMatching(OBJECT_ID_FORMAT),
    _id: expect.stringMatching(OBJECT_ID_FORMAT),
    updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
    createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
  }));

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();
  });

  beforeEach(async () => {
    await mongoDb().collection('applicants').deleteMany({});
    await mongoDb().collection('credentialSubmissions').deleteMany({});
    disclosureMetadata = {
      exchangeId: new ObjectId().toString(),
      presentationId: new ObjectId().toString(),
      vendorOrganizationId: new ObjectId().toString(),
      vendorDisclosureId: new ObjectId().toString(),
    };
    credentials = [
      {
        ...adamSmithId,
        ...credentialChecks,
      },
      {
        ...juniorPM,
        ...credentialChecks,
      },
      {
        ...seniorPM,
        ...credentialChecks,
      },
    ];
  });

  after(async () => {
    await fastify.close();
  });

  describe('receive applicant flow', () => {
    const applicant = {
      email: 'adam.smith@example.com',
      firstName: {
        localized: {
          en: 'Adam',
        },
      },
      lastName: {
        localized: {
          en: 'Smith',
        },
      },
      location: {
        countryCode: 'US',
        regionCode: 'CA',
      },
      phone: '+1 555 619 2191',
    };

    const applicantCredentials = [
      {
        ...juniorPM,
        ...credentialChecks,
      },
    ];

    it('should be able to create and add creds', async () => {
      const applicantPayload = {
        ...disclosureMetadata,
        ...applicant,
      };
      const applicantResponse = await fastify.injectJson({
        method: 'POST',
        url: '/inspection/find-or-create-applicant',
        payload: applicantPayload,
      });
      expect(applicantResponse.statusCode).toEqual(200);
      expect(applicantResponse.json).toEqual({
        vendorApplicantId: expect.any(String),
      });

      const credentialsPayload = {
        ...disclosureMetadata,
        vendorApplicantId: applicantResponse.json.vendorApplicantId,
        credentials: applicantCredentials,
      };
      const credentialsResponse = await fastify.injectJson({
        method: 'POST',
        url: '/inspection/add-credentials-to-applicant',
        payload: credentialsPayload,
      });
      expect(credentialsResponse.statusCode).toEqual(200);
      expect(credentialsResponse.json).toEqual({
        numProcessed: 1,
      });

      expect(
        (await fastify.injectJson({ method: 'GET', url: '/api/applicants' }))
          .json
      ).toEqual([
        {
          ...applicantPayload,
          id: expect.stringMatching(OBJECT_ID_FORMAT),
          _id: expect.stringMatching(OBJECT_ID_FORMAT),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        },
      ]);

      expect(
        (
          await fastify.injectJson({
            method: 'GET',
            url: '/api/credential-submissions',
          })
        ).json
      ).toEqual(
        map(
          (credential) => ({
            ...credential,
            vendorApplicantId: applicantResponse.json.vendorApplicantId,
          }),
          prepareCredentialsApiResponse(credentialsPayload.credentials)
        )
      );
    });
  });

  describe('retrieving creds', () => {
    let payload;
    beforeEach(async () => {
      payload = {
        ...disclosureMetadata,
        credentials,
      };
      await fastify.injectJson({
        method: 'POST',
        url: '/inspection/receive-checked-credentials',
        payload,
      });
    });

    describe('filter by vendorDisclosureId', () => {
      it('return nothing for non existing ids', async () => {
        expect(
          (
            await fastify.injectJson({
              method: 'GET',
              url: '/api/credential-submissions?vendorDisclosureId=1111',
            })
          ).json
        ).toEqual([]);
      });
      it('filter by ids', async () => {
        expect(
          (
            await fastify.injectJson({
              method: 'GET',
              url: `/api/credential-submissions?vendorDisclosureId=${payload.vendorDisclosureId}`,
            })
          ).json
        ).toEqual(
          expect.arrayContaining(
            prepareCredentialsApiResponse(payload.credentials)
          )
        );
      });
    });
    describe('filter by dates', () => {
      it('return nothing if none on particular dateFrom', async () => {
        expect(
          (
            await fastify.injectJson({
              method: 'GET',
              url: `/api/credential-submissions?dateFrom=${flow(
                endOfDay,
                addDays(1),
                formatISOWithOptions({ representation: 'date' })
              )(new Date())}`,
            })
          ).json
        ).toEqual([]);
      });
      it('filter by dateFrom', async () => {
        expect(
          (
            await fastify.injectJson({
              method: 'GET',
              url: `/api/credential-submissions?dateFrom=${flow(
                startOfDay,
                formatISOWithOptions({ representation: 'date' })
              )(new Date())}`,
            })
          ).json
        ).toEqual(
          expect.arrayContaining(
            prepareCredentialsApiResponse(payload.credentials)
          )
        );
      });
      it('return nothing if none on particular dateUntil', async () => {
        expect(
          (
            await fastify.injectJson({
              method: 'GET',
              url: `/api/credential-submissions?dateUntil=${flow(
                startOfDay,
                subDays(1),
                formatISOWithOptions({ representation: 'date' })
              )(new Date())}`,
            })
          ).json
        ).toEqual([]);
      });
      it('filter by dateUntil', async () => {
        expect(
          (
            await fastify.injectJson({
              method: 'GET',
              url: `/api/credential-submissions?dateFrom=${flow(
                startOfDay,
                formatISOWithOptions({ representation: 'date' })
              )(new Date())}`,
            })
          ).json
        ).toEqual(
          expect.arrayContaining(
            prepareCredentialsApiResponse(payload.credentials)
          )
        );
      });
    });
  });

  describe('receive checked credentials flow', () => {
    it('should be able to create and add creds', async () => {
      const payload = {
        ...disclosureMetadata,
        credentials,
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/inspection/receive-checked-credentials',
        payload,
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        numProcessed: 3,
      });

      expect(
        (
          await fastify.injectJson({
            method: 'GET',
            url: '/api/credential-submissions',
          })
        ).json
      ).toEqual(
        expect.arrayContaining(
          prepareCredentialsApiResponse(payload.credentials)
        )
      );
    });
  });

  describe('receive unchecked credentials flow', () => {
    it('should be able to create and add creds', async () => {
      const payload = {
        ...disclosureMetadata,
        credentials,
      };
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/inspection/receive-unchecked-credentials',
        payload,
      });
      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        numProcessed: 3,
      });

      expect(
        (
          await fastify.injectJson({
            method: 'GET',
            url: '/api/credential-submissions',
          })
        ).json
      ).toEqual(
        expect.arrayContaining(
          prepareCredentialsApiResponse(payload.credentials)
        )
      );
    });
  });
});
