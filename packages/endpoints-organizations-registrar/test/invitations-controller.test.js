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

const { after, before, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { subDays } = require('date-fns/fp');
const { omit } = require('lodash/fp');
const { ISO_DATETIME_FORMAT } = require('@verii/test-regexes');
const {
  mongoify,
  errorResponseMatcher,
  testNoGroupRegistrarUser,
} = require('@verii/tests-helpers');
const { ObjectId } = require('mongodb');
const initInvitationsFactory = require('../src/entities/invitations/factories/invitations-factory');
const initOrganizationsFactory = require('../src/entities/organizations/factories/organizations-factory');
const buildFastify = require('./helpers/build-fastify');

const { invitationsRepoPlugin } = require('../src/entities/invitations');

const invitationsUrl = (code) => `/api/v0.6/invitations/${code}`;

describe('Invitations controller test suite', () => {
  let fastify;
  let invitationsRepo;
  let persistOrganization;
  let persistInvitation;

  const clearDb = async () => {
    await mongoDb().collection('organizations').deleteMany({});
    await mongoDb().collection('invitations').deleteMany({});
    await mongoDb().collection('groups').deleteMany({});
  };

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();
    ({ persistInvitation } = initInvitationsFactory(fastify));
    ({ persistOrganization } = initOrganizationsFactory(fastify));

    invitationsRepo = invitationsRepoPlugin(fastify)({
      log: fastify.log,
      config: fastify.config,
    });
  });

  beforeEach(async () => {
    await clearDb();
  });

  after(async () => {
    await fastify.close();
  });

  describe('Get invitation by code Test Suite', () => {
    it('should return 404 if invitation does not exist', async () => {
      const response = await fastify.injectJson({
        method: 'GET',
        url: invitationsUrl('foo'),
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'invitation_not_found',
          message: 'Invitation not found',
          statusCode: 404,
        })
      );
    });

    it('should return 400 if invitation is expired', async () => {
      const code = 'foo';
      await persistInvitation({
        code,
        expiresAt: subDays(1, new Date()),
      });
      const response = await fastify.injectJson({
        method: 'GET',
        url: invitationsUrl('foo'),
      });

      expect(response.statusCode).toEqual(400);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          errorCode: 'invitation_expired',
          message: 'Invitation has expired',
          statusCode: 400,
        })
      );
    });

    it('should return an invitation by code', async () => {
      const code = 'foo';
      const inviterOrganization = await persistOrganization();
      const invitation = await persistInvitation({
        inviterOrganization,
        code,
        inviteeProfile: {
          name: 'fooName',
          description: 'fooDescription',
          linkedInProfile: 'https://www.linkedin.com/in/test-profile',
          physicalAddress: {
            line1: '123 Main St',
            line2: 'Suite 123',
            line3: 'New York',
          },
        },
        inviteeService: [
          {
            id: '#foo',
            type: 'foo',
            serviceEndpoint: 'foo#bar',
          },
        ],
        keyIndividuals: {
          adminGivenName: 'Bob',
          adminFamilyName: 'Foobar',
          adminTitle: 'PM',
          adminEmail: 'pm@example.com',
        },
        invitationUrl: 'http://foo,invitation',
        createdBy: 'fooUser1',
        updatedBy: 'fooUser1',
        acceptedBy: 'fooUser2',
        acceptedAt: new Date(),
      });
      const response = await fastify.injectJson({
        method: 'GET',
        url: invitationsUrl('foo'),
        headers: {
          'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
        },
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        invitation: invitationResponseExpectation(
          invitation,
          inviterOrganization
        ),
      });

      const invitationFromDb = await invitationsRepo.findOne({
        filter: { code },
      });
      expect(invitationFromDb).toEqual({
        ...invitation,
        _id: new ObjectId(invitation._id),
        acceptedAt: expect.any(Date),
        acceptedBy: 'fooUser2',
        updatedBy: 'fooUser1',
        updatedAt: expect.any(Date),
        createdAt: new Date(invitation.createdAt),
        expiresAt: new Date(invitation.expiresAt),
      });
    });

    it('should return an invitation by code with a wallet provider service', async () => {
      const code = 'foo';
      const inviterOrganization = await persistOrganization();
      const invitation = await persistInvitation({
        inviterOrganization,
        code,
        inviteeDid: 'fooInviteeDid',
        inviteeProfile: {
          name: 'fooName',
          description: 'fooDescription',
          linkedInProfile: 'https://www.linkedin.com/in/test-profile',
          physicalAddress: {
            line1: '123 Main St',
            line2: 'Suite 123',
            line3: 'New York',
          },
        },
        inviteeService: [
          {
            id: '#foo',
            type: 'foo',
            serviceEndpoint: 'https://foo#bar',
          },
        ],
        keyIndividuals: {
          adminGivenName: 'Bob',
          adminFamilyName: 'Foobar',
          adminTitle: 'PM',
          adminEmail: 'pm@example.com',
        },
        invitationUrl: 'http://foo,invitation',
        createdBy: 'fooUser1',
        updatedBy: 'fooUser1',
        acceptedBy: 'fooUser2',
        acceptedAt: new Date(),
      });
      const response = await fastify.injectJson({
        method: 'GET',
        url: invitationsUrl('foo'),
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        invitation: invitationResponseExpectation(
          invitation,
          inviterOrganization
        ),
      });

      const invitationFromDb = await invitationsRepo.findOne({
        filter: { code },
      });
      expect(invitationFromDb).toEqual({
        ...invitation,
        _id: new ObjectId(invitation._id),
        acceptedAt: expect.any(Date),
        acceptedBy: 'fooUser2',
        updatedBy: 'fooUser1',
        updatedAt: expect.any(Date),
        createdAt: new Date(invitation.createdAt),
        expiresAt: new Date(invitation.expiresAt),
      });
    });

    it('should return an key individuals', async () => {
      const code = 'foo';
      const inviterOrganization = await persistOrganization();
      const invitation = await persistInvitation({
        inviterOrganization,
        code,
        inviteeDid: 'fooInviteeDid',
        inviteeProfile: {
          name: 'fooName',
        },
        inviteeService: [
          {
            id: '#foo',
            type: 'foo',
            serviceEndpoint: 'foo#bar',
          },
        ],
        keyIndividuals: {
          adminGivenName: 'Bob',
          adminFamilyName: 'Foobar',
          adminTitle: 'PM',
          adminEmail: 'pm@example.com',
          signatoryGivenName: 'Jane',
          signatoryFamilyName: 'Barfoo',
          signatoryTitle: 'CEO',
          signatoryEmail: 'cao@example.com',
        },
        invitationUrl: 'http://foo,invitation',
        createdBy: 'fooUser1',
        updatedBy: 'fooUser1',
        acceptedBy: 'fooUser2',
        acceptedAt: new Date(),
      });
      const response = await fastify.injectJson({
        method: 'GET',
        url: invitationsUrl('foo'),
      });

      expect(response.statusCode).toEqual(200);
      expect(response.json).toEqual({
        invitation: invitationResponseExpectation(
          invitation,
          inviterOrganization
        ),
      });

      const invitationFromDb = await invitationsRepo.findOne({
        filter: { code },
      });
      expect(invitationFromDb).toEqual(
        mongoify({
          _id: invitation._id,
          acceptedAt: expect.any(Date),
          acceptedBy: 'fooUser2',
          inviterDid: inviterOrganization.didDoc.id,
          inviteeDid: 'fooInviteeDid',
          inviteeEmail: 'foo@example.com',
          inviteeProfile: {
            name: 'fooName',
          },
          inviteeService: [
            {
              id: '#foo',
              type: 'foo',
              serviceEndpoint: 'foo#bar',
            },
          ],
          keyIndividuals: {
            adminGivenName: 'Bob',
            adminFamilyName: 'Foobar',
            adminTitle: 'PM',
            adminEmail: 'pm@example.com',
            signatoryGivenName: 'Jane',
            signatoryFamilyName: 'Barfoo',
            signatoryTitle: 'CEO',
            signatoryEmail: 'cao@example.com',
          },
          invitationUrl: 'http://foo,invitation',
          code,
          createdBy: 'fooUser1',
          updatedBy: 'fooUser1',
          expiresAt: expect.any(Date),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
    });

    it('should return error if invitation deleted', async () => {
      const code = 'foo';
      const inviterOrganization = await persistOrganization();
      const invitation = await persistInvitation({
        inviterOrganization,
        code,
        inviteeDid: 'fooInviteeDid',
        inviteeProfile: {
          name: 'fooName',
          description: 'fooDescription',
        },
        inviteeService: [
          {
            id: '#foo',
            type: 'foo',
            serviceEndpoint: 'foo#bar',
          },
        ],
        invitationUrl: 'http://foo,invitation',
        createdBy: 'fooUser1',
        updatedBy: 'fooUser1',
        acceptedBy: 'fooUser2',
        acceptedAt: new Date(),
        deletedBy: 'fooUser2',
        deletedAt: new Date(),
      });
      const response = await fastify.injectJson({
        method: 'GET',
        url: invitationsUrl('foo'),
      });

      expect(response.statusCode).toEqual(404);
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Not Found',
          errorCode: 'invitation_not_found',
          message: 'Invitation not found',
          statusCode: 404,
        })
      );
      const invitationFromDb = await invitationsRepo
        .collection()
        .find()
        .toArray();
      expect(invitationFromDb).toEqual([
        mongoify({
          _id: invitation._id,
          acceptedAt: expect.any(Date),
          acceptedBy: 'fooUser2',
          inviterDid: inviterOrganization.didDoc.id,
          inviteeDid: 'fooInviteeDid',
          inviteeEmail: 'foo@example.com',
          inviteeProfile: {
            name: 'fooName',
            description: 'fooDescription',
          },
          inviteeService: [
            {
              id: '#foo',
              type: 'foo',
              serviceEndpoint: 'foo#bar',
            },
          ],
          invitationUrl: 'http://foo,invitation',
          code,
          createdBy: 'fooUser1',
          updatedBy: 'fooUser1',
          deletedBy: 'fooUser2',
          expiresAt: expect.any(Date),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          deletedAt: expect.any(Date),
        }),
      ]);
    });
  });
});

const invitationResponseExpectation = (
  invitation,
  inviterOrganization,
  overrides
) => {
  return {
    ...omit(['_id'], invitation),
    id: invitation._id.toString(),
    inviterDid: inviterOrganization.didDoc.id,
    acceptedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
    acceptedBy: 'fooUser2',
    expiresAt: expect.stringMatching(ISO_DATETIME_FORMAT),
    createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
    updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
    ...overrides,
  };
};
