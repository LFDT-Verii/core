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

const {
  sendReminders: originalSendReminders,
} = require('../src/entities/signatories/orchestrators/send-reminders');

class SESClient {}
const mockSESSendEmail = mock.fn((payload) => payload);
SESClient.prototype.send = mockSESSendEmail;
mock.module('@aws-sdk/client-ses', {
  namedExports: {
    SendEmailCommand: class SendEmailCommand {
      constructor(args) {
        return args;
      }
    },
    SESClient,
  },
});

const mockSendReminders = mock.fn();
mock.module('../src/entities/signatories/orchestrators/send-reminders.js', {
  namedExports: { mockSendReminders },
});

const mockSendSupportEmail = mock.fn((payload) => payload);

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { ObjectId } = require('mongodb');
const { subDays, subMonths, subHours } = require('date-fns/fp');
const { ServiceTypes } = require('@verii/organizations-registry');
const { errorResponseMatcher } = require('@verii/tests-helpers');
const { NANO_ID_FORMAT } = require('@verii/test-regexes/src/regexes');
const buildFastify = require('./helpers/build-fastify');
const initOrganizationFactory = require('../src/entities/organizations/factories/organizations-factory');
const initSignatoryStatusFactory = require('../src/entities/signatories/factories/signatory-status-factory');
const initInvitationFactory = require('../src/entities/invitations/factories/invitations-factory');
const {
  expectedSignatoryApprovedEmail,
  expectedSignatoryRejectedEmail,
  expectedSignatoryReminderEmail,
  expectedSupportMaxSignatoryReminderReachedEmailParams,
} = require('./helpers/email-matchers');
const signatoryStatusPlugin = require('../src/entities/signatories/repos/repo');
const organizationsPlugin = require('../src/entities/organizations/repos/repo');
const invitationsPlugin = require('../src/entities/invitations/repo');
const {
  initSendEmailNotifications,
  SignatoryEventStatus,
} = require('../src/entities');

describe('signatoriesController', () => {
  let testContext;
  let fastify;
  let persistOrganization;
  let persistInvitation;
  let persistSignatoryStatus;
  let signatoryStatusRepo;
  let organizationsRepo;
  let invitationsRepo;
  let sendEmailToSignatoryForOrganizationApproval;

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();
    ({ persistOrganization } = initOrganizationFactory(fastify));
    ({ persistSignatoryStatus } = initSignatoryStatusFactory(fastify));
    ({ persistInvitation } = initInvitationFactory(fastify));

    signatoryStatusRepo = signatoryStatusPlugin(fastify)({
      log: fastify.log,
      config: fastify.config,
    });
    organizationsRepo = organizationsPlugin(fastify)({
      log: fastify.log,
      config: fastify.config,
    });
    invitationsRepo = invitationsPlugin(fastify)({
      log: fastify.log,
      config: fastify.config,
    });

    ({ sendEmailToSignatoryForOrganizationApproval } =
      await initSendEmailNotifications(fastify));
    testContext = {
      ...fastify,
      repos: {
        signatoryStatus: signatoryStatusRepo,
        organizations: organizationsRepo,
        invitations: invitationsRepo,
      },
      renderTemplate: fastify.view,
      sendSupportEmail: mockSendSupportEmail,
    };
  });

  beforeEach(async () => {
    mockSESSendEmail.mock.resetCalls();
    await mongoDb().collection('organizations').deleteMany({});
    await mongoDb().collection('invitations').deleteMany({});
    await mongoDb().collection('signatoryStatus').deleteMany({});
    await mongoDb().collection('registrarConsents').deleteMany({});
  });

  after(async () => {
    await fastify.close();
    mock.reset();
  });

  describe('GET /:did/signatories/response/approve', () => {
    it('should send email', async () => {
      const organization = await persistOrganization();
      const signatory = await persistSignatoryStatus({
        organization,
      });
      const response = await fastify.injectJson({
        method: 'GET',
        url: `/api/v0.6/organizations/${organization.didDoc.id}/signatories/response/approve?authCode=${signatory.authCodes[0].code}`,
      });
      expect(response.statusCode).toEqual(200);
      expect(mockSESSendEmail.mock.callCount()).toEqual(1);
      expect(mockSESSendEmail.mock.calls[0].arguments[0]).toEqual(
        expectedSignatoryApprovedEmail(organization),
      );
    });

    it('should send email, mark signatory reminder approved, and register a consent', async () => {
      const organization = await persistOrganization();
      const signatory = await persistSignatoryStatus({
        organization,
      });
      const response = await fastify.injectJson({
        method: 'GET',
        url: `/api/v0.6/organizations/${organization.didDoc.id}/signatories/response/approve?authCode=${signatory.authCodes[0].code}`,
      });
      expect(response.statusCode).toEqual(200);
      const signatoryReminderDb = await signatoryStatusRepo.findOne({
        filter: {
          organizationDid: organization.didDoc.id,
        },
      });
      expect(signatoryReminderDb).toEqual({
        _id: expect.any(ObjectId),
        organizationDid: organization.didDoc.id,
        organizationId: new ObjectId(organization._id),
        events: [
          {
            state: SignatoryEventStatus.LINK_SENT,
            timestamp: expect.any(Date),
          },
          {
            state: SignatoryEventStatus.APPROVED,
            timestamp: expect.any(Date),
          },
          {
            state: SignatoryEventStatus.COMPLETED,
            timestamp: expect.any(Date),
          },
        ],
        authCodes: [
          {
            code: '12345',
            timestamp: expect.any(Date),
          },
        ],
        approvedAt: expect.any(Date),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      const dbRegistrarConsent = await mongoDb()
        .collection('registrarConsents')
        .findOne();
      expect(dbRegistrarConsent).toEqual({
        _id: expect.any(ObjectId),
        consentId: expect.stringMatching(NANO_ID_FORMAT),
        createdAt: expect.any(Date),
        organizationId: new ObjectId(organization._id),
        type: 'Signatory',
        userId: organization.profile.signatoryEmail,
        version: 1,
      });
    });

    it('should return 401 if signatory with auth code does not exist', async () => {
      const organization = await persistOrganization();
      const response = await fastify.injectJson({
        method: 'GET',
        url: `/api/v0.6/organizations/${organization.didDoc.id}/signatories/response/approve?authCode=999`,
      });
      expect(response.statusCode).toEqual(401);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Unauthorized',
          errorCode: 'unauthorized',
          message: 'Unauthorized',
          statusCode: 401,
        }),
      );
    });

    it('should return 400 if authCode is old', async () => {
      const organization = await persistOrganization();
      await persistSignatoryStatus({
        organization,
        authCodes: [
          {
            code: '1',
            timestamp: subDays(4)(new Date()),
          },
          {
            code: '2',
            timestamp: subDays(1)(new Date()),
          },
        ],
      });
      const response = await fastify.injectJson({
        method: 'GET',
        url: `/api/v0.6/organizations/${organization.didDoc.id}/signatories/response/approve?authCode=1`,
      });
      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'auth_code_must_be_most_recent',
          message: 'Please use the latest email sent.',
          statusCode: 400,
        }),
      );
    });

    it('should return 400 if signatory has already approved', async () => {
      const organization = await persistOrganization();
      await persistSignatoryStatus({
        organization,
        authCodes: [
          {
            code: '1',
            timestamp: subDays(4)(new Date()),
          },
          {
            code: '2',
            timestamp: subDays(1)(new Date()),
          },
        ],
        events: [
          {
            state: SignatoryEventStatus.APPROVED,
            timestamp: new Date(),
          },
          {
            state: SignatoryEventStatus.COMPLETED,
            timestamp: new Date(),
          },
        ],
      });
      const response = await fastify.injectJson({
        method: 'GET',
        url: `/api/v0.6/organizations/${organization.didDoc.id}/signatories/response/approve?authCode=1`,
      });
      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'signatory_status_already_complete',
          message: 'Signatory has already signed',
          statusCode: 400,
        }),
      );
    });

    it('should return 400 if authCode expired', async () => {
      const organization = await persistOrganization();
      await persistSignatoryStatus({
        organization,
        authCodes: [
          {
            code: '1',
            timestamp: subHours(48)(new Date()),
          },
        ],
      });
      const response = await fastify.injectJson({
        method: 'GET',
        url: `/api/v0.6/organizations/${organization.didDoc.id}/signatories/response/approve?authCode=1`,
      });
      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'auth_code_expired',
          message: 'Auth code has expired.',
          statusCode: 400,
        }),
      );
    });

    it('should return 404 if organization does not exist', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: '/api/v0.6/organizations/did:test:1/signatories/response/approve?authCode=12345',
      });
      expect(response.statusCode).toEqual(404);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'organization_not_found',
          message: 'Organization not found',
          statusCode: 404,
        }),
      );
      expect(mockSESSendEmail.mock.callCount()).toEqual(0);
    });
  });

  describe('GET /:did/signatories/response/reject', () => {
    it('should send email', async () => {
      const organization = await persistOrganization();
      const signatory = await persistSignatoryStatus({
        organization,
      });
      const response = await fastify.injectJson({
        method: 'GET',
        url: `/api/v0.6/organizations/${organization.didDoc.id}/signatories/response/reject?authCode=${signatory.authCodes[0].code}`,
      });
      expect(response.statusCode).toEqual(200);
      expect(mockSESSendEmail.mock.callCount()).toEqual(1);
      expect(mockSESSendEmail.mock.calls[0].arguments[0]).toEqual(
        expectedSignatoryRejectedEmail(organization),
      );
    });

    it('should send email and mark signatory reminder as rejected', async () => {
      const organization = await persistOrganization();
      const signatory = await persistSignatoryStatus({
        organization,
      });
      const response = await fastify.injectJson({
        method: 'GET',
        url: `/api/v0.6/organizations/${organization.didDoc.id}/signatories/response/reject?authCode=${signatory.authCodes[0].code}`,
      });
      expect(response.statusCode).toEqual(200);
      const signatoryReminderDb = await signatoryStatusRepo.findOne({
        filter: {
          organizationDid: organization.didDoc.id,
        },
      });
      expect(signatoryReminderDb).toEqual({
        _id: expect.any(ObjectId),
        organizationDid: organization.didDoc.id,
        organizationId: new ObjectId(organization._id),
        events: [
          {
            state: SignatoryEventStatus.LINK_SENT,
            timestamp: expect.any(Date),
          },
          {
            state: SignatoryEventStatus.REJECTED,
            timestamp: expect.any(Date),
          },
          {
            state: SignatoryEventStatus.COMPLETED,
            timestamp: expect.any(Date),
          },
        ],
        authCodes: [
          {
            code: '12345',
            timestamp: expect.any(Date),
          },
        ],
        rejectedAt: expect.any(Date),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should return 401 if signatory with auth code does not exist', async () => {
      const organization = await persistOrganization();
      const response = await fastify.injectJson({
        method: 'GET',
        url: `/api/v0.6/organizations/${organization.didDoc.id}/signatories/response/reject?authCode=999`,
      });
      expect(response.statusCode).toEqual(401);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Unauthorized',
          errorCode: 'unauthorized',
          message: 'Unauthorized',
          statusCode: 401,
        }),
      );
    });

    it('should return 400 if authCode is old', async () => {
      const organization = await persistOrganization();
      await persistSignatoryStatus({
        organization,
        authCodes: [
          {
            code: '1',
            timestamp: subDays(4)(new Date()),
          },
          {
            code: '2',
            timestamp: subDays(1)(new Date()),
          },
        ],
      });
      const response = await fastify.injectJson({
        method: 'GET',
        url: `/api/v0.6/organizations/${organization.didDoc.id}/signatories/response/reject?authCode=1`,
      });
      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'auth_code_must_be_most_recent',
          message: 'Please use the latest email sent.',
          statusCode: 400,
        }),
      );
    });

    it('should 400 if signatory has already rejected', async () => {
      const organization = await persistOrganization();
      const signatoryStatus = await persistSignatoryStatus({
        organization,
        events: [
          {
            state: SignatoryEventStatus.REJECTED,
            timestamp: new Date(),
          },
          {
            state: SignatoryEventStatus.COMPLETED,
            timestamp: new Date(),
          },
        ],
      });
      const response = await fastify.injectJson({
        method: 'GET',
        url: `/api/v0.6/organizations/${organization.didDoc.id}/signatories/response/reject?authCode=${signatoryStatus.authCodes[0].code}`,
      });
      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'signatory_status_already_complete',
          message: 'Signatory has already signed',
          statusCode: 400,
        }),
      );
      expect(mockSESSendEmail.mock.callCount()).toEqual(0);
    });

    it('should return 400 if authCode expired', async () => {
      const organization = await persistOrganization();
      await persistSignatoryStatus({
        organization,
        authCodes: [
          {
            code: '1',
            timestamp: subMonths(4)(new Date()),
          },
        ],
      });
      const response = await fastify.injectJson({
        method: 'GET',
        url: `/api/v0.6/organizations/${organization.didDoc.id}/signatories/response/reject?authCode=1`,
      });
      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'auth_code_expired',
          message: 'Auth code has expired.',
          statusCode: 400,
        }),
      );
    });

    it('should return 404 if organization does not exist', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: '/api/v0.6/organizations/did:test:1/signatories/response/reject?authCode=12345',
      });
      expect(response.statusCode).toEqual(404);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'organization_not_found',
          message: 'Organization not found',
          statusCode: 404,
        }),
      );
      expect(mockSESSendEmail.mock.callCount()).toEqual(0);
    });
  });

  describe('POST /send-reminder', () => {
    it('should return 200', async () => {
      mockSendReminders.mock.mockImplementationOnce(() =>
        Promise.resolve(undefined),
      );
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/api/v0.6/signatories/send-reminder',
        payload: {},
      });
      expect(response.statusCode).toEqual(200);
    });

    it('1234 should return 200 if something went wrong', async () => {
      mockSendReminders.mock.mockImplementationOnce(() =>
        Promise.reject(new Error('Something went wrong')),
      );
      const response = await fastify.injectJson({
        method: 'POST',
        url: '/api/v0.6/signatories/send-reminder',
        payload: {},
      });
      expect(response.statusCode).toEqual(200);
    });

    it('should not send emails if there are no signatory reminders', async () => {
      await originalSendReminders(
        sendEmailToSignatoryForOrganizationApproval,
        testContext,
      );
      expect(mockSESSendEmail.mock.callCount()).toEqual(0);
    });

    it('should send emails if there are active signatory reminders', async () => {
      const inviterOrganization = await persistOrganization();
      const invitation1 = await persistInvitation({
        inviterOrganization,
      });
      const organization1 = await persistOrganization({
        invitationId: new ObjectId(invitation1._id),
        service: [
          {
            id: '#iss-1',
            type: ServiceTypes.HolderAppProviderType,
            serviceEndpoint: `${inviterOrganization.didDoc.id}#cao-1`,
          },
        ],
      });
      const invitation2 = await persistInvitation({
        inviterOrganization,
      });
      const organization2 = await persistOrganization({
        invitationId: new ObjectId(invitation2._id),
        service: [
          {
            id: '#iss-1',
            type: ServiceTypes.HolderAppProviderType,
            serviceEndpoint: `${inviterOrganization.didDoc.id}#cao-1`,
          },
        ],
      });

      const signatoryStatus1 = await persistSignatoryStatus({
        organization: organization1,
        events: [
          {
            state: SignatoryEventStatus.LINK_SENT,
            timestamp: subDays(8)(new Date()),
          },
        ],
      });
      const signatoryStatus2 = await persistSignatoryStatus({
        organization: organization2,
        events: [
          {
            state: SignatoryEventStatus.LINK_SENT,
            timestamp: subDays(8)(new Date()),
          },
        ],
      });
      const signatoryStatus3 = await persistSignatoryStatus({
        organization: organization2,
        events: [
          {
            state: SignatoryEventStatus.LINK_SENT,
            timestamp: subDays(8)(new Date()),
          },
          {
            state: SignatoryEventStatus.LINK_SENT,
            timestamp: new Date(),
          },
        ],
      });
      await originalSendReminders(
        sendEmailToSignatoryForOrganizationApproval,
        testContext,
      );

      expect(mockSESSendEmail.mock.calls.map((call) => call.arguments)).toEqual(
        [
          [expectedSignatoryReminderEmail(inviterOrganization, organization2)],
          [expectedSignatoryReminderEmail(inviterOrganization, organization1)],
        ],
      );

      const signatoryStatus3Db = await signatoryStatusRepo.findOne({
        filter: {
          _id: new ObjectId(signatoryStatus3._id),
        },
      });
      expect(signatoryStatus3Db).toEqual({
        _id: expect.any(ObjectId),
        organizationDid: expect.any(String),
        organizationId: expect.any(ObjectId),
        events: [
          {
            state: SignatoryEventStatus.LINK_SENT,
            timestamp: expect.any(Date),
          },
          {
            state: SignatoryEventStatus.LINK_SENT,
            timestamp: expect.any(Date),
          },
        ],
        authCodes: [
          {
            code: '12345',
            timestamp: expect.any(Date),
          },
        ],
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      const signatoryStatusDb1 = await signatoryStatusRepo.findOne({
        filter: {
          _id: new ObjectId(signatoryStatus1._id),
        },
      });
      expect(signatoryStatusDb1).toEqual({
        _id: expect.any(ObjectId),
        organizationDid: organization1.didDoc.id,
        organizationId: new ObjectId(organization1._id),
        events: [
          {
            state: SignatoryEventStatus.LINK_SENT,
            timestamp: expect.any(Date),
          },
          {
            state: SignatoryEventStatus.LINK_SENT,
            timestamp: expect.any(Date),
          },
        ],
        authCodes: [
          {
            code: '12345',
            timestamp: expect.any(Date),
          },
          {
            code: expect.stringMatching(NANO_ID_FORMAT),
            timestamp: expect.any(Date),
          },
        ],
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      const signatoryReminderDb2 = await signatoryStatusRepo.findOne({
        filter: {
          _id: new ObjectId(signatoryStatus2._id),
        },
      });
      expect(signatoryReminderDb2).toEqual({
        _id: expect.any(ObjectId),
        organizationDid: organization2.didDoc.id,
        organizationId: new ObjectId(organization2._id),
        events: [
          {
            state: SignatoryEventStatus.LINK_SENT,
            timestamp: expect.any(Date),
          },
          {
            state: SignatoryEventStatus.LINK_SENT,
            timestamp: expect.any(Date),
          },
        ],
        authCodes: [
          {
            code: '12345',
            timestamp: expect.any(Date),
          },
          {
            code: expect.stringMatching(NANO_ID_FORMAT),
            timestamp: expect.any(Date),
          },
        ],
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should send email to support if max reminder count is reached and mark as complete', async () => {
      const organization = await persistOrganization({});

      const signatoryStatus1 = await persistSignatoryStatus({
        organization,
        events: [
          {
            state: SignatoryEventStatus.LINK_SENT,
            timestamp: subDays(8)(new Date()),
          },
          {
            state: SignatoryEventStatus.LINK_SENT,
            timestamp: subDays(8)(new Date()),
          },
          {
            state: SignatoryEventStatus.LINK_SENT,
            timestamp: subDays(8)(new Date()),
          },
        ],
      });
      await originalSendReminders(
        sendEmailToSignatoryForOrganizationApproval,
        testContext,
      );

      expect(mockSESSendEmail.mock.calls).toEqual([]);
      expect(
        mockSendSupportEmail.mock.calls.map((call) => call.arguments),
      ).toEqual([expectedSupportMaxSignatoryReminderReachedEmailParams()]);

      const signatoryStatusDb1 = await signatoryStatusRepo.findOne({
        filter: {
          _id: new ObjectId(signatoryStatus1._id),
        },
      });
      expect(signatoryStatusDb1).toEqual({
        _id: expect.any(ObjectId),
        organizationDid: organization.didDoc.id,
        organizationId: new ObjectId(organization._id),
        events: [
          {
            state: SignatoryEventStatus.LINK_SENT,
            timestamp: expect.any(Date),
          },
          {
            state: SignatoryEventStatus.LINK_SENT,
            timestamp: expect.any(Date),
          },
          {
            state: SignatoryEventStatus.LINK_SENT,
            timestamp: expect.any(Date),
          },
          {
            state: SignatoryEventStatus.MAX_REACHED,
            timestamp: expect.any(Date),
          },
          {
            state: SignatoryEventStatus.COMPLETED,
            timestamp: expect.any(Date),
          },
        ],
        authCodes: [
          {
            code: '12345',
            timestamp: expect.any(Date),
          },
        ],
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should resend emails if enough time has passed since previous email', async () => {
      const organization = await persistOrganization();
      await persistSignatoryStatus({
        organization,
        events: [
          {
            state: SignatoryEventStatus.LINK_SENT,
            timestamp: subDays(7)(new Date()),
          },
          {
            state: SignatoryEventStatus.LINK_SENT,
            timestamp: subDays(1)(new Date()),
          },
        ],
      });
      await originalSendReminders(
        sendEmailToSignatoryForOrganizationApproval,
        testContext,
      );
      expect(mockSESSendEmail.mock.callCount()).toEqual(1);
      expect(mockSESSendEmail.mock.calls[0].arguments).toEqual([
        expectedSignatoryReminderEmail(null, organization),
      ]);
    });

    it('should not send emails if there are signatory reminders with completed state', async () => {
      const organization = await persistOrganization();
      await persistSignatoryStatus({
        organization,
        events: [
          {
            state: SignatoryEventStatus.COMPLETED,
            timestamp: new Date(),
          },
        ],
        approvedAt: new Date(),
      });
      await originalSendReminders(
        sendEmailToSignatoryForOrganizationApproval,
        testContext,
      );
      expect(mockSESSendEmail.mock.callCount()).toEqual(0);
    });

    it('should not send emails if there are signatory reminders but email was sent within delay period from config', async () => {
      const organization = await persistOrganization();
      await persistSignatoryStatus({
        organization,
        events: [
          {
            state: SignatoryEventStatus.LINK_SENT,
            timestamp: subHours(10)(new Date()),
          },
        ],
      });
      await originalSendReminders(
        sendEmailToSignatoryForOrganizationApproval,
        testContext,
      );
      expect(mockSESSendEmail.mock.callCount()).toEqual(0);
    });

    it('should not send emails if sending fail', async () => {
      const caoOrganization = await persistOrganization();
      const organization = await persistOrganization({
        service: [
          {
            id: '#iss-1',
            type: ServiceTypes.ContactIssuerType,
            serviceEndpoint: `${caoOrganization.didDoc.id}#cao-1`,
          },
        ],
      });
      const signatoryReminder = await persistSignatoryStatus({
        organization,
        events: [
          {
            state: SignatoryEventStatus.LINK_SENT,
            timestamp: subDays(8)(new Date()),
          },
        ],
      });
      mockSESSendEmail.mock.mockImplementationOnce(() =>
        Promise.reject(new Error('Failed to send email')),
      );
      await originalSendReminders(
        sendEmailToSignatoryForOrganizationApproval,
        testContext,
      );
      expect(mockSESSendEmail.mock.callCount()).toEqual(1);
      const signatoryReminderDb = await signatoryStatusRepo.findOne({
        filter: {
          _id: new ObjectId(signatoryReminder._id),
        },
      });
      expect(signatoryReminderDb).toEqual({
        _id: expect.any(ObjectId),
        organizationDid: organization.didDoc.id,
        organizationId: new ObjectId(organization._id),
        events: [
          {
            state: SignatoryEventStatus.LINK_SENT,
            timestamp: expect.any(Date),
          },
          {
            state: SignatoryEventStatus.REMINDER_ERROR,
            timestamp: expect.any(Date),
          },
        ],
        authCodes: [
          {
            code: '12345',
            timestamp: expect.any(Date),
          },
        ],
        error: 'Failed to send email',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should not send emails if org mark as soft deleted', async () => {
      const organization = await persistOrganization({
        deletedAt: new Date(),
      });
      const signatoryReminder = await persistSignatoryStatus({
        organization,
        events: [
          {
            state: SignatoryEventStatus.LINK_SENT,
            timestamp: subDays(8)(new Date()),
          },
        ],
      });
      await originalSendReminders(
        sendEmailToSignatoryForOrganizationApproval,
        testContext,
      );
      expect(mockSESSendEmail.mock.callCount()).toEqual(0);
      const signatoryReminderDb = await signatoryStatusRepo.findOne({
        filter: {
          _id: new ObjectId(signatoryReminder._id),
        },
      });
      expect(signatoryReminderDb).toEqual({
        _id: expect.any(ObjectId),
        organizationDid: organization.didDoc.id,
        organizationId: new ObjectId(organization._id),
        events: [
          {
            state: SignatoryEventStatus.LINK_SENT,
            timestamp: expect.any(Date),
          },
          {
            state: SignatoryEventStatus.REMINDER_ERROR,
            timestamp: expect.any(Date),
          },
        ],
        authCodes: [
          {
            code: '12345',
            timestamp: expect.any(Date),
          },
        ],
        error: 'Organization not found',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
  });
});
