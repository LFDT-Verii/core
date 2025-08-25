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
// eslint-disable-next-line max-classes-per-file
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

const mockInitSendError = mock.fn(() =>
  Promise.resolve({
    sendError: (err) => {
      console.log(`fake capturing exception: ${err.message}`);
    },
    startProfiling: () => {
      console.log('fake start sentry profiling');
    },
    finishProfiling: () => {
      console.log('fake finish sentry profiling');
    },
  })
);

mock.module('@verii/error-aggregation', {
  namedExports: {
    initSendError: mockInitSendError,
  },
});

const mockAuth0ClientDelete = mock.fn(async ({ id }) => {
  console.log(`deleting auth0 client ${id}`);
});
const mockAuth0ClientGrantDelete = mock.fn(async ({ id }) => {
  console.log(`deleting auth0 client grant ${id}`);
});
const mockAuth0ClientCreate = mock.fn(async (obj) => {
  const id = nanoid();
  console.log(`create auth0 client ${id}`);
  return { client_id: id, client_secret: nanoid(), ...obj };
});
const mockAuth0ClientGrantCreate = mock.fn(async (obj) => {
  const id = nanoid();
  console.log(`create auth0 clientGrant ${id}`);
  return { id: nanoid(), ...obj };
});
const mockAuth0UserUpdate = mock.fn(async ({ id }, obj) => {
  console.log(`update auth0 user ${id}`);
  return { id, ...obj };
});
const mockAuth0GetUsers = mock.fn(() =>
  Promise.resolve({
    email: `${mockAuth0GetUsers.mock.callCount()}@localhost.test`,
  })
);

class ManagementClient {
  constructor() {
    this.clients = {
      create: mockAuth0ClientCreate,
      delete: mockAuth0ClientDelete,
    };
    this.clientGrants = {
      create: mockAuth0ClientGrantCreate,
      delete: mockAuth0ClientGrantDelete,
    };
    this.users = {
      update: mockAuth0UserUpdate,
    };
    this.getUsers = mockAuth0GetUsers;
  }
}
mock.module('auth0', {
  namedExports: {
    ManagementClient,
  },
});

const mockAddPrimary = mock.fn(() => Promise.resolve(undefined));
const mockAddOperator = mock.fn(() => Promise.resolve(undefined));
const mockRemoveOperator = mock.fn(() => Promise.resolve(undefined));
const mockInitPermission = mock.fn(() =>
  Promise.resolve({
    addPrimary: mockAddPrimary,
    addOperatorKey: mockAddOperator,
    removeOperatorKey: mockRemoveOperator,
  })
);
mock.module('@verii/contract-permissions', {
  namedExports: {
    ...require('../../contract-permissions/src/constants'),
    initPermissions: mockInitPermission,
  },
});

const mockCreateFineractClient = mock.fn();
const mockCreateStakesAccount = mock.fn();
mock.module('@verii/fineract-client', {
  namedExports: {
    createFineractClient: mockCreateFineractClient,
    createStakesAccount: mockCreateStakesAccount,
  },
});

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

const { map, omit } = require('lodash/fp');

const { nanoid } = require('nanoid');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { generateKeyPair } = require('@verii/crypto');
const { decodeCredentialJwt } = require('@verii/jwt');
const {
  AUTH0_USER_ID_FORMAT,
  ISO_DATETIME_FORMAT,
  UUID_FORMAT,
} = require('@verii/test-regexes');

const {
  testWriteOrganizationsUser,
  testReadOrganizationsUser,
  testRegistrarSuperUser,
  errorResponseMatcher,
  DEFAULT_GROUP_ID,
  testNoGroupRegistrarUser,
  mongoify,
} = require('@verii/tests-helpers');
const { ServiceTypes } = require('@verii/organizations-registry');
const { ObjectId } = require('mongodb');

const console = require('console');

const nock = require('nock');
const { CheckResults } = require('@verii/vc-checks');
const buildFastify = require('./helpers/build-fastify');
const initOrganizationFactory = require('../src/entities/organizations/factories/organizations-factory');
const initImageFactory = require('../src/entities/images/factories/images-factory');
const initGroupsFactory = require('../src/entities/groups/factories/groups-factory');
const organizationsRepoPlugin = require('../src/entities/organizations/repos/repo');
const imagesRepoPlugin = require('../src/entities/images/repo');

const {
  buildFullOrganizationResponse,
  ImageState,
  VNF_GROUP_ID_CLAIM,
} = require('../src/entities');

const {
  buildPublicServices,
} = require('../src/entities/organization-services/domains/build-public-services');

const baseUrl = '/api/v0.6/organizations';
const fullUrl = '/api/v0.6/organizations/full';

const publicProfileMatcher = (profile) =>
  omit(
    [
      'adminGivenName',
      'adminFamilyName',
      'adminTitle',
      'adminEmail',
      'signatoryGivenName',
      'signatoryFamilyName',
      'signatoryTitle',
      'signatoryEmail',
    ],
    profile
  );

describe('Organization Registrar Test Suite', { timeout: 20000 }, () => {
  let fastify;
  let organizationsRepo;
  let persistOrganization;
  let newOrganization;
  let persistGroup;
  let persistImage;
  let imagesRepo;

  const getOrganizationFromDb = (did) =>
    mongoDb().collection('organizations').findOne({
      'didDoc.id': did,
    });

  const clearDb = async () => {
    await mongoDb().collection('organizations').deleteMany({});
    await mongoDb().collection('organizationKeys').deleteMany({});
    await mongoDb().collection('groups').deleteMany({});
    await mongoDb().collection('images').deleteMany({});
  };

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();
    ({ persistOrganization, newOrganization } =
      initOrganizationFactory(fastify));

    ({ persistGroup } = initGroupsFactory(fastify));

    organizationsRepo = organizationsRepoPlugin(fastify)({
      log: fastify.log,
      config: fastify.config,
    });

    imagesRepo = imagesRepoPlugin(fastify)({
      log: fastify.log,
      config: fastify.config,
    });

    ({ persistImage } = initImageFactory(fastify));

    await mongoDb()
      .collection('credentialSchemas')
      .insertMany([
        { credentialType: 'EducationDegree' },
        { credentialType: 'PastEmploymentPosition' },
      ]);
  }, 10000);

  beforeEach(async () => {
    mockCreateStakesAccount.mock.mockImplementation(() =>
      Promise.resolve('foo')
    );
    nock.cleanAll();
  });

  after(async () => {
    await mongoDb().collection('credentialSchemas').deleteMany({});
    await fastify.close();
    nock.cleanAll();
    nock.restore();
    mock.reset();
  });

  describe('Organization Modifications', () => {
    let orgProfile;

    before(async () => {
      const org = await newOrganization();
      orgProfile = omit(
        ['id', 'createdAt', 'updatedAt', 'website'],
        org.profile
      );
    });

    beforeEach(async () => {
      await clearDb();
    });

    describe('Organization Profile Modification', () => {
      it('Should return 400 when request is malformed', async () => {
        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/profile/did:test:doesnt-matter`,
          payload: {},
        });

        expect(response.statusCode).toEqual(400);
      });

      it('Should return 404 when organization not found', async () => {
        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/profile/did:test:notfound`,
          payload: orgProfile,
        });

        expect(response.statusCode).toEqual(404);
      });

      it('Should return 403 if user is missing organization:write permission', async () => {
        const organization = await persistOrganization();
        await persistGroup({
          groupId: DEFAULT_GROUP_ID,
          dids: [organization.didDoc.id],
        });

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/profile/${organization.didDoc.id}`,
          payload: orgProfile,
          headers: {
            'x-override-oauth-user': JSON.stringify(testReadOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(403);
      });

      it('Should return 404 if user has no group', async () => {
        const organization = await persistOrganization();
        await persistGroup({
          groupId: DEFAULT_GROUP_ID,
          dids: [organization.didDoc.id],
        });

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/profile/${organization.didDoc.id}`,
          payload: orgProfile,
          headers: {
            'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
          },
        });

        expect(response.statusCode).toEqual(404);
      });

      it('Should return 404 if user is a member of another group', async () => {
        const organization = await persistOrganization();
        await persistGroup({
          groupId: organization.didDoc.id,
          dids: [organization.didDoc.id],
        });

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/profile/${organization.didDoc.id}`,
          payload: orgProfile,
          headers: {
            'x-override-oauth-user': JSON.stringify(testWriteOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(404);
      });

      it('Should return 400 when technicalEmail is missed', async () => {
        const organization = await persistOrganization();
        await persistGroup({
          dids: [organization.didDoc.id],
          clientAdminIds: [testWriteOrganizationsUser.sub],
        });
        const payload = {
          ...omit(['technicalEmail'])(orgProfile),
        };

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/profile/${organization.didDoc.id}`,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testWriteOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'request_validation_failed',
            message: "body must have required property 'technicalEmail'",
            statusCode: 400,
          })
        );
      });

      it('Should return 400 when contactEmail is missed', async () => {
        const organization = await persistOrganization();
        await persistGroup({
          dids: [organization.didDoc.id],
          clientAdminIds: [testWriteOrganizationsUser.sub],
        });
        const payload = {
          ...omit(['contactEmail'])(orgProfile),
        };

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/profile/${organization.didDoc.id}`,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testWriteOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'request_validation_failed',
            message: "body must have required property 'contactEmail'",
            statusCode: 400,
          })
        );
      });

      it('Should return 400 when description is missed', async () => {
        const organization = await persistOrganization();
        await persistGroup({
          dids: [organization.didDoc.id],
          clientAdminIds: [testWriteOrganizationsUser.sub],
        });
        const payload = {
          ...omit(['description'])(orgProfile),
        };

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/profile/${organization.didDoc.id}`,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testWriteOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'request_validation_failed',
            message: "body must have required property 'description'",
            statusCode: 400,
          })
        );
      });

      it('Should 400 with duplicate profile name when DB profile has empty spaces', async () => {
        await persistOrganization({
          name: ' Gabriel \t    Biggus \n Antonius',
          normalizedProfileName: 'gabriel biggus antonius',
        });

        const organization = await persistOrganization({
          name: 'gabriel biggus antonius!',
          normalizedProfileName: 'gabriel biggus antonius!',
        });

        await persistGroup({
          dids: [organization.didDoc.id],
          clientAdminIds: [testRegistrarSuperUser.sub],
        });

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/profile/${organization.didDoc.id}`,
          payload: {
            ...omit(['name', 'website'])(organization.profile),
            name: 'gabriel biggus antonius',
          },
          headers: {
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'name_change_forbidden',
            message: 'Organization name already exists',
            statusCode: 400,
          })
        );
      });

      it('Should 400 with duplicate profile name when payload has empty spaces', async () => {
        await persistOrganization({
          name: 'gabriel biggus antonius',
          normalizedProfileName: 'gabriel biggus antonius',
        });

        const organization = await persistOrganization({
          name: 'gabriel biggus antonius!',
          normalizedProfileName: 'gabriel biggus antonius!',
        });

        await persistGroup({
          dids: [organization.didDoc.id],
          clientAdminIds: [testRegistrarSuperUser.sub],
        });

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/profile/${organization.didDoc.id}`,
          payload: {
            ...omit(['name', 'website'])(organization.profile),
            name: ' Gabriel \t    Biggus \n Antonius',
          },
          headers: {
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'name_change_forbidden',
            message: 'Organization name already exists',
            statusCode: 400,
          })
        );
      });

      it('Should 400 with invalid commercialEntities info', async () => {
        const organization = await persistOrganization({
          name: 'gabriel biggus antonius!',
          normalizedProfileName: 'gabriel biggus antonius!',
        });

        await persistGroup({
          dids: [organization.didDoc.id],
          clientAdminIds: [testRegistrarSuperUser.sub],
        });

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/profile/${organization.didDoc.id}`,
          payload: {
            ...omit(['commercial'])(organization.profile),
            commercialEntities: [
              {
                type: 'Brand',
                name: 'mock',
                logo: 'not-url',
              },
            ],
          },
          headers: {
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'request_validation_failed',
            message: 'body/commercialEntities/0/logo must match format "uri"',
            statusCode: 400,
          })
        );
      });

      it('Should 400 with duplicate profile name when db record and payload have regexp special symbols', async () => {
        const organization = await persistOrganization({
          name: 'gabriel biggus antonius!',
          normalizedProfileName: 'gabriel biggus antonius!',
        });

        await persistGroup({
          dids: [organization.didDoc.id],
          clientAdminIds: [testRegistrarSuperUser.sub],
        });

        const secondOrg = await persistOrganization({
          name: 'gabriel! biggus* antonius?',
          normalizedProfileName: 'gabriel! biggus* antonius?',
        });

        await persistGroup({
          dids: [secondOrg.didDoc.id],
          clientAdminIds: [testRegistrarSuperUser.sub],
        });

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/profile/${organization.didDoc.id}`,
          payload: {
            ...omit(['name', 'website'])(organization.profile),
            name: ' gabriel!     \t biggus* \n AntoNius?',
          },
          headers: {
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'name_change_forbidden',
            message: 'Organization name already exists',
            statusCode: 400,
          })
        );
      });

      it('Should 400 with duplicate profile name and ignoring letter cases', async () => {
        await persistOrganization({
          normalizedProfileName: 'gabriel biggus antonius',
        });

        const organization = await persistOrganization({
          normalizedProfileName: 'gabriel biggus antonius!',
        });

        console.log(organization);

        await persistGroup({
          dids: [organization.didDoc.id],
          clientAdminIds: [testRegistrarSuperUser.sub],
        });

        const payload = {
          ...omit(['name', 'website'])(organization.profile),
          name: 'Gabriel Biggus Antonius',
        };

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/profile/${organization.didDoc.id}`,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'name_change_forbidden',
            message: 'Organization name already exists',
            statusCode: 400,
          })
        );
      });

      it("Should return 400 if name wasn't changed but user is not an admin", async () => {
        const organization = await persistOrganization();
        await persistGroup({
          dids: [organization.didDoc.id],
          clientAdminIds: [testWriteOrganizationsUser.sub],
        });
        const updatedName = `${orgProfile.name}-up`;
        const payload = {
          ...omit(['name', 'website'])(orgProfile),
          name: updatedName,
        };

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/profile/${organization.didDoc.id}`,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testWriteOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            message: 'Name change forbidden',
            errorCode: 'name_change_forbidden',
            statusCode: 400,
          })
        );
      });

      it('Should succeed if adminGivenName and adminFamilyName is missed', async () => {
        const organization = await persistOrganization();
        await persistGroup({
          dids: [organization.didDoc.id],
          clientAdminIds: [testWriteOrganizationsUser.sub],
        });
        const payload = {
          ...omit(['adminGivenName', 'adminFamilyName', 'website'])(orgProfile),
        };

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/profile/${organization.didDoc.id}`,
          payload,
          headers: {
            'x-override-oauth-user': JSON.stringify(testWriteOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          ...organization.profile,
          id: organization.didDoc.id,
          verifiableCredentialJwt: expect.any(String),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });
      });

      it('Should return 400 if logo already active', async () => {
        await persistImage({
          url: 'https://example.com/logo.png',
          state: ImageState.ACTIVE,
        });
        const organization = await persistOrganization();
        const payload = {
          ...omit(['logo'])(orgProfile),
          logo: 'https://example.com/logo.png',
        };

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/profile/${organization.didDoc.id}`,
          payload,
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'image_already_active',
            message: 'Image already active',
            statusCode: 400,
          })
        );
      });

      it('Should return 400 when website is present', async () => {
        const organization = await persistOrganization();
        await persistGroup({
          dids: [organization.didDoc.id],
          clientAdminIds: [testWriteOrganizationsUser.sub],
        });

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/profile/${organization.didDoc.id}`,
          payload: {
            ...orgProfile,
            website: 'https://foo.example.com',
          },
          headers: {
            'x-override-oauth-user': JSON.stringify(testWriteOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'website_must_not_be_specified',
            message: 'Website must not be specified',
            statusCode: 400,
          })
        );
      });

      it('Should update organization logo and activate image', async () => {
        await persistImage({
          url: 'https://example.com/old.png',
          state: ImageState.ACTIVE,
          uploadSucceeded: true,
        });
        await persistImage({
          url: 'https://example.com/logo.png',
          state: ImageState.UPLOAD_DONE,
          uploadSucceeded: true,
        });
        const { profile } = await newOrganization();
        const organization = await persistOrganization({
          profile: {
            ...profile,
            logo: 'https://example.com/old.png',
          },
        });
        const payload = {
          ...omit(['logo'])(orgProfile),
          logo: 'https://example.com/logo.png',
        };

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/profile/${organization.didDoc.id}`,
          payload,
        });

        expect(response.statusCode).toEqual(200);

        const imageDbNew = await imagesRepo.findOne({
          filter: {
            url: 'https://example.com/logo.png',
          },
        });
        expect(imageDbNew).toStrictEqual({
          _id: expect.anything(),
          updatedAt: expect.anything(),
          createdAt: expect.anything(),
          key: 'file-1234567.png',
          state: 'active',
          uploadSucceeded: true,
          uploadUrl: 'http://aws.s3.test/file-1234567.png',
          url: 'https://example.com/logo.png',
          userId: expect.stringMatching(AUTH0_USER_ID_FORMAT),
        });

        const imageDbOld = await imagesRepo.findOne({
          filter: {
            url: 'https://example.com/old.png',
          },
        });
        expect(imageDbOld).toStrictEqual({
          _id: expect.anything(),
          updatedAt: expect.anything(),
          createdAt: expect.anything(),
          key: 'file-1234567.png',
          state: 'inactive',
          uploadSucceeded: true,
          uploadUrl: 'http://aws.s3.test/file-1234567.png',
          url: 'https://example.com/old.png',
          userId: expect.stringMatching(AUTH0_USER_ID_FORMAT),
        });
      });

      it('Should update organization logo and deactivation of image not found', async () => {
        await persistImage({
          url: 'https://example.com/logo.png',
          state: ImageState.UPLOAD_DONE,
          uploadSucceeded: true,
        });
        const { profile } = await newOrganization();
        const organization = await persistOrganization({
          profile: {
            ...profile,
            logo: 'https://example.com/old.png',
          },
        });
        const payload = {
          ...omit(['logo'])(orgProfile),
          logo: 'https://example.com/logo.png',
        };

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/profile/${organization.didDoc.id}`,
          payload,
        });

        expect(response.statusCode).toEqual(200);

        const imageDbNew = await imagesRepo.findOne({
          filter: {
            url: 'https://example.com/logo.png',
          },
        });
        expect(imageDbNew).toStrictEqual({
          _id: expect.anything(),
          updatedAt: expect.anything(),
          createdAt: expect.anything(),
          key: 'file-1234567.png',
          state: 'active',
          uploadSucceeded: true,
          uploadUrl: 'http://aws.s3.test/file-1234567.png',
          url: 'https://example.com/logo.png',
          userId: expect.stringMatching(AUTH0_USER_ID_FORMAT),
        });
      });

      it('Should update organization profile', async () => {
        const organization = await persistOrganization();
        const updatedName = `${orgProfile.name}-UPDATE`;
        const additionalProfileProperties = {
          adminGivenName: 'A-given-name',
          adminFamilyName: 'A-family-name',
          adminTitle: 'A-title',
          adminEmail: 'admin@email.com',
          signatoryGivenName: 'S-given-name',
          signatoryFamilyName: 'S-family-name',
          signatoryTitle: 'S-title',
          signatoryEmail: 'signatory@email.com',
        };
        const payload = {
          ...orgProfile,
          name: updatedName,
          ...additionalProfileProperties,
        };

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/profile/${organization.didDoc.id}`,
          payload,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          ...organization.profile,
          name: updatedName,
          ...additionalProfileProperties,
          id: organization.didDoc.id,
          verifiableCredentialJwt: expect.any(String),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });

        const orgFromDb = await getOrganizationFromDb(organization.didDoc.id);
        expect(orgFromDb.profile).toEqual({
          ...organization.profile,
          name: updatedName,
          ...additionalProfileProperties,
        });

        const credentialPayload = decodeCredentialJwt(
          orgFromDb.signedProfileVcJwt.signedCredential
        );
        expect(credentialPayload).toEqual({
          credentialSubject: {
            ...publicProfileMatcher({ ...organization.profile, ...payload }),
            id: orgFromDb.didDoc.id,
          },
          id: expect.stringMatching(UUID_FORMAT),
          issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          issuer: {
            id: fastify.config.rootDid,
          },
          type: ['OrganizationBasicProfile-v1.0', 'VerifiableCredential'],
        });
      });

      it('Should update with empty commercialEntities in the organization profile', async () => {
        const organization = await persistOrganization();
        const commercialEntities = [];
        const payload = {
          ...omit(['commercials'])(orgProfile),
          commercialEntities,
        };

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/profile/${organization.didDoc.id}`,
          payload,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          ...organization.profile,
          commercialEntities: [],
          id: organization.didDoc.id,
          verifiableCredentialJwt: expect.any(String),
          updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
          createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        });

        const orgFromDb = await getOrganizationFromDb(organization.didDoc.id);
        expect(orgFromDb.profile).toEqual({
          ...organization.profile,
          commercialEntities: [],
        });

        const credentialPayload = decodeCredentialJwt(
          orgFromDb.signedProfileVcJwt.signedCredential
        );
        expect(credentialPayload).toEqual({
          credentialSubject: {
            ...publicProfileMatcher({ ...organization.profile, ...payload }),
            commercialEntities: [],
            id: orgFromDb.didDoc.id,
          },
          id: expect.stringMatching(UUID_FORMAT),
          issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          issuer: {
            id: fastify.config.rootDid,
          },
          type: ['OrganizationBasicProfile-v1.0', 'VerifiableCredential'],
        });
      });

      it('Should update commercials in the organization profile', async () => {
        const organization = await persistOrganization({
          commercialEntities: [
            {
              type: 'Brand',
              logo: 'https://mock',
              name: 'mock',
            },
          ],
        });
        const commercialEntities = [
          {
            type: 'Brand',
            logo: 'https://logo.com',
            name: 'Commercial 1',
            description: 'Commercial 1 description',
          },
          {
            type: 'Department',
            logo: 'https://logo.com',
            name: 'Commercial 2',
          },
        ];
        const payload = {
          ...omit(['commercials'])(orgProfile),
          commercialEntities,
        };

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/profile/${organization.didDoc.id}`,
          payload,
        });

        expect(response.statusCode).toEqual(200);
        const orgFromDb = await getOrganizationFromDb(organization.didDoc.id);
        expect(orgFromDb.profile).toEqual({
          ...organization.profile,
          commercialEntities,
        });

        const credentialPayload = decodeCredentialJwt(
          orgFromDb.signedProfileVcJwt.signedCredential
        );
        expect(credentialPayload).toEqual({
          credentialSubject: {
            ...publicProfileMatcher({ ...organization.profile, ...payload }),
            commercialEntities,
            id: orgFromDb.didDoc.id,
          },
          id: expect.stringMatching(UUID_FORMAT),
          issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          issuer: {
            id: fastify.config.rootDid,
          },
          type: ['OrganizationBasicProfile-v1.0', 'VerifiableCredential'],
        });
      });

      it('Should update organization profile and createdAt still should exists', async () => {
        const organization = await persistOrganization();
        const updatedName = `${orgProfile.name}-UPDATE`;
        const payload = {
          ...orgProfile,
          name: updatedName,
        };

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/profile/${organization.didDoc.id}`,
          payload,
        });

        expect(response.statusCode).toEqual(200);
        const orgFromDb = await getOrganizationFromDb(organization.didDoc.id);
        expect(orgFromDb.profile).toEqual({
          ...organization.profile,
          name: updatedName,
        });

        const credentialPayload = decodeCredentialJwt(
          orgFromDb.signedProfileVcJwt.signedCredential
        );
        expect(credentialPayload).toEqual({
          credentialSubject: {
            ...publicProfileMatcher({ ...organization.profile, ...payload }),
            id: orgFromDb.didDoc.id,
          },
          id: expect.stringMatching(UUID_FORMAT),
          issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          issuer: {
            id: fastify.config.rootDid,
          },
          type: ['OrganizationBasicProfile-v1.0', 'VerifiableCredential'],
        });
      });
    });
  });

  describe('Organization Soft Delete', () => {
    it('Should 404 trying to delete an organization thats not found', async () => {
      const response = await fastify.injectJson({
        method: 'DELETE',
        url: `${baseUrl}/did:test:notrealdid`,
      });
      expect(response.json).toEqual(
        errorResponseMatcher({
          statusCode: 404,
          error: 'Not Found',
          errorCode: 'organization_not_found',
          message: 'Organization not found',
        })
      );
    });

    it('Should fail to delete an organization with activated services', async () => {
      const services = [
        {
          id: '#credentialagent-1',
          type: ServiceTypes.CredentialAgentOperatorType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        },
      ];
      const organization = await persistOrganization({
        service: services,
        activatedServiceIds: map('id', services),
      });
      const response = await fastify.injectJson({
        method: 'DELETE',
        url: `${baseUrl}/${organization.didDoc.id}`,
      });
      expect(response.json).toEqual(
        errorResponseMatcher({
          error: 'Bad Request',
          message: 'Cant delete. First remove activated services',
          statusCode: 400,
        })
      );
    });

    it('Should soft delete an organization with superuser role', async () => {
      const organization = await persistOrganization();
      await persistGroup({ groupId: organization.didDoc.id });

      const response = await fastify.injectJson({
        method: 'DELETE',
        url: `${baseUrl}/${organization.didDoc.id}`,
        headers: {
          'x-override-oauth-user': JSON.stringify(testRegistrarSuperUser),
        },
      });

      expect(response.statusCode).toEqual(204);
      const orgFromDb = await getOrganizationFromDb(organization.didDoc.id);
      expect(orgFromDb).toEqual({
        ...mongoify(organization),
        deletedAt: expect.any(Date),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        ids: expect.any(Object),
        authClients: expect.any(Array),
        signedProfileVcJwt: expect.any(Object),
      });
    });

    it('Should soft delete an organization with registrar client admin role', async () => {
      const organization = await persistOrganization();
      await persistGroup({
        groupId: DEFAULT_GROUP_ID,
        dids: [organization.didDoc.id],
        clientAdminIds: [testWriteOrganizationsUser.sub],
      });

      const response = await fastify.injectJson({
        method: 'DELETE',
        url: `${baseUrl}/${organization.didDoc.id}`,
        headers: {
          'x-override-oauth-user': JSON.stringify(testWriteOrganizationsUser),
        },
      });

      expect(response.statusCode).toEqual(204);
      const orgFromDb = await getOrganizationFromDb(organization.didDoc.id);
      expect(orgFromDb).toEqual({
        ...mongoify(organization),
        deletedAt: expect.any(Date),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        ids: expect.any(Object),
        authClients: expect.any(Array),
        signedProfileVcJwt: expect.any(Object),
      });
    });
  });

  describe('Organization Retrieval', () => {
    describe('GET Organization DID Doc', () => {
      let organization;
      before(async () => {
        await clearDb();
        organization = await persistOrganization();
      });

      it('Should return 404 when organization not found', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/did:test:notfound`,
        });

        expect(response.statusCode).toEqual(404);
      });

      it('Should return 403 if user is missing organization:write permission', async () => {
        await persistGroup({
          groupId: DEFAULT_GROUP_ID,
          dids: [organization.didDoc.id],
        });

        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/${organization.didDoc.id}`,
          headers: {
            'x-override-oauth-user': JSON.stringify(testWriteOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(403);
      });

      it('Should return 404 if user has no group', async () => {
        await persistGroup({
          groupId: DEFAULT_GROUP_ID,
          dids: [organization.didDoc.id],
        });

        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/${organization.didDoc.id}`,
          headers: {
            'x-override-oauth-user': JSON.stringify(testNoGroupRegistrarUser),
          },
        });

        expect(response.statusCode).toEqual(404);
      });

      it('Should return 404 if user is a member of another group', async () => {
        await persistGroup({
          groupId: organization.didDoc.id,
          dids: [organization.didDoc.id],
        });

        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/${organization.didDoc.id}`,
          headers: {
            'x-override-oauth-user': JSON.stringify(testReadOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(404);
      });

      it('Should return an organization using a read:org scope', async () => {
        await persistGroup({
          groupId: DEFAULT_GROUP_ID,
          dids: [organization.didDoc.id],
        });

        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/${organization.didDoc.id}`,
          headers: {
            'x-override-oauth-user': JSON.stringify(testReadOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual(organization.didDoc);
      });

      it('Should return an organization using a Superuser', async () => {
        await persistGroup({
          groupId: DEFAULT_GROUP_ID,
          dids: [organization.didDoc.id],
        });

        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/${organization.didDoc.id}`,
          headers: {
            'x-override-oauth-user': JSON.stringify(testReadOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual(organization.didDoc);
      });

      it('Should return an organization with HolderAppProvider service', async () => {
        const holderAppServiceAllFields = {
          id: '#wallet-provider-1',
          type: ServiceTypes.HolderAppProviderType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
          playStoreUrl: 'http://example.com/play-store',
          appleAppStoreUrl: 'http://example.com/apple-app-store',
          appleAppId: 'com.example.app',
          googlePlayId: 'com.example.app',
          logoUrl: 'http://example.com/logo',
          name: 'fooWallet',
        };
        const org = await persistOrganization({
          service: [holderAppServiceAllFields],
        });
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/${org.didDoc.id}`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual(org.didDoc);
        expect(response.json.service[0]).toEqual({
          ...holderAppServiceAllFields,
        });
      });
    });

    describe('GET Full Organization', () => {
      let organization;
      before(async () => {
        await clearDb();
        organization = await persistOrganization({
          service: [
            {
              id: '#credentialagent-1',
              type: ServiceTypes.CredentialAgentOperatorType,
              serviceEndpoint: 'https://agent.samplevendor.com/acme',
              invitationId: 'abc',
            },
          ],
        });
      });

      it('Should return 404 when organization not found', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${fullUrl}/did:test:notfound`,
        });

        expect(response.statusCode).toEqual(404);
      });

      it('Should 404 for an organization without a group', async () => {
        await persistGroup({
          dids: [],
          clientAdminIds: [testReadOrganizationsUser.sub],
        });
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${fullUrl}/${organization.didDoc.id}`,
          headers: {
            'x-override-oauth-user': JSON.stringify(testReadOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(404);
      });

      it('Should 404 for a read scope user who doesnt have a group', async () => {
        await Promise.all([
          persistGroup({
            groupId: organization.didDoc.id,
            dids: [organization.didDoc.id],
            clientAdminIds: [nanoid()],
          }),
        ]);
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${fullUrl}/${organization.didDoc.id}`,
          headers: {
            'x-override-oauth-user': JSON.stringify(
              omit([VNF_GROUP_ID_CLAIM], testReadOrganizationsUser)
            ),
          },
        });

        expect(response.statusCode).toEqual(404);
      });

      it('Should 404 for a read scope user whose group does not contain the organization', async () => {
        await Promise.all([
          persistGroup({
            groupId: testReadOrganizationsUser[VNF_GROUP_ID_CLAIM],
            dids: [],
            clientAdminIds: [testReadOrganizationsUser.sub],
          }),
          persistGroup({
            groupId: organization.didDoc.id,
            dids: [organization.didDoc.id],
            clientAdminIds: [nanoid()],
          }),
        ]);
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${fullUrl}/${organization.didDoc.id}`,
          headers: {
            'x-override-oauth-user': JSON.stringify(testReadOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(404);
      });

      it('Should not return an organization that was deleted', async () => {
        const deletedOrg = await persistOrganization({
          deletedAt: Date('2023-02-27T14:40:18'),
        });
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${fullUrl}/${deletedOrg.didDoc.id}`,
        });

        expect(response.statusCode).toEqual(404);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Not Found',
            errorCode: 'organization_not_found',
            message: 'Organization not found',
            statusCode: 404,
          })
        );
      });

      it('Should return an organization with old structured profile', async () => {
        const org = await newOrganization();
        const orgProfile = omit(['id', 'createdAt', 'updatedAt'], org.profile);
        const profile = omit(['technicalEmail', 'description'], orgProfile);

        const oldFormatOrganization = await persistOrganization({
          profile,
        });
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${fullUrl}/${oldFormatOrganization.didDoc.id}`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual(
          buildFullOrganizationResponse({
            organization: oldFormatOrganization,
          })
        );
      });

      it('Should return an organization with empty email in profile', async () => {
        const org = await newOrganization();
        const orgProfile = omit(
          ['id', 'createdAt', 'updatedAt', 'contactEmail', 'technicalEmail'],
          org.profile
        );
        const expectedOrganization = await persistOrganization({
          ...org,
          profile: orgProfile,
        });
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${fullUrl}/${expectedOrganization.didDoc.id}`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual(
          buildFullOrganizationResponse({
            organization: expectedOrganization,
          })
        );
        expect(response.json.profile.technicalEmail).toBeUndefined();
        expect(response.json.profile.contactEmail).toBeUndefined();
      });

      it('Should return an organization', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${fullUrl}/${organization.didDoc.id}`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual(
          buildFullOrganizationResponse({
            organization,
            services: buildPublicServices(organization.services),
          })
        );
      });

      it('Should return an organization with admin and signatory properties in profile', async () => {
        const additionalProfileProperties = {
          adminGivenName: 'A-given-name',
          adminFamilyName: 'A-family-name',
          adminTitle: 'A-title',
          adminEmail: 'admin@email.com',
          signatoryGivenName: 'S-given-name',
          signatoryFamilyName: 'S-family-name',
          signatoryTitle: 'S-title',
          signatoryEmail: 'signatory@email.com',
        };
        const newOrg = await newOrganization();
        const orgProfile = {
          ...omit(['id', 'createdAt', 'updatedAt'], newOrg.profile),
          ...additionalProfileProperties,
        };
        const org = await persistOrganization({
          ...newOrg,
          profile: orgProfile,
          service: [
            {
              id: '#credentialagent-999',
              type: ServiceTypes.CareerIssuerType,
              credentialTypes: ['EducationDegree'],
              serviceEndpoint:
                'https://agent.samplevendor.com/acme/api/999/get-credential-manifest',
            },
          ],
        });

        const response = await fastify.injectJson({
          method: 'GET',
          url: `${fullUrl}/${org.didDoc.id}`,
        });

        const expectedOrg = buildFullOrganizationResponse({
          organization: org,
          services: buildPublicServices(org.services),
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          ...expectedOrg,
          profile: {
            ...expectedOrg.profile,
            ...additionalProfileProperties,
          },
        });
      });

      describe('Get Organization with Wallet Provider service Test Suite', () => {
        beforeEach(async () => {
          await clearDb();
        });
        it('Should return an organization with HolderAppProvider service with additional fields', async () => {
          const org = await persistOrganization({
            service: [
              {
                id: '#credentialagent-999',
                type: ServiceTypes.HolderAppProviderType,
                serviceEndpoint: 'https://agent.samplevendor.com',
                appleAppStoreUrl: 'http://example.com/apple-app-store',
                appleAppId: 'com.example.app',
                googlePlayId: 'com.example.app',
                logoUrl: 'http://example.com/logo',
                name: 'fooWallet',
              },
            ],
          });
          const response = await fastify.injectJson({
            method: 'GET',
            url: `${fullUrl}/${org.didDoc.id}`,
          });

          const expectedOrg = buildFullOrganizationResponse({
            organization: org,
            services: buildPublicServices(org.services),
          });
          expect(response.statusCode).toEqual(200);
          expect(response.json).toEqual(expectedOrg);
        });
        it('Should return an organization with HolderAppProvider when additional fields have not been added', async () => {
          const org = await persistOrganization({
            service: [
              {
                id: '#credentialagent-999',
                type: ServiceTypes.HolderAppProviderType,
                serviceEndpoint: 'https://agent.samplevendor.com',
                supportedExchangeProtocols: ['VN_API'],
              },
            ],
          });
          const response = await fastify.injectJson({
            method: 'GET',
            url: `${fullUrl}/${org.didDoc.id}`,
          });

          const expectedOrg = buildFullOrganizationResponse({
            organization: org,
            services: buildPublicServices(org.services),
          });
          expect(response.statusCode).toEqual(200);
          expect(response.json).toEqual(expectedOrg);
        });
        it('Should return an organization with WebWalletProvider service with additional fields', async () => {
          const org = await persistOrganization({
            service: [
              {
                id: '#credentialagent-999',
                type: ServiceTypes.WebWalletProviderType,
                serviceEndpoint: 'https://agent.samplevendor.com',
                logoUrl: 'http://example.com/logo',
                name: 'fooWallet',
                supportedExchangeProtocols: ['VN_API'],
              },
            ],
          });
          const response = await fastify.injectJson({
            method: 'GET',
            url: `${fullUrl}/${org.didDoc.id}`,
          });

          const expectedOrg = buildFullOrganizationResponse({
            organization: org,
            services: buildPublicServices(org.services),
          });
          expect(response.statusCode).toEqual(200);
          expect(response.json).toEqual(expectedOrg);
        });
        it('Should return an organization with WebWalletProvider when additional fields have not been added', async () => {
          const org = await persistOrganization({
            service: [
              {
                id: '#credentialagent-999',
                type: ServiceTypes.HolderAppProviderType,
                serviceEndpoint: 'https://agent.samplevendor.com',
              },
            ],
          });
          const response = await fastify.injectJson({
            method: 'GET',
            url: `${fullUrl}/${org.didDoc.id}`,
          });

          const expectedOrg = buildFullOrganizationResponse({
            organization: org,
            services: buildPublicServices(org.services),
          });
          expect(response.statusCode).toEqual(200);
          expect(response.json).toEqual(expectedOrg);
        });
      });
    });
  });

  describe('Organization Public API', () => {
    describe('Organization Verifiable Credentials Retrieval by Type', () => {
      let organization;

      before(async () => {
        await clearDb();
        organization = await persistOrganization();
      });

      it('Should 400 without type query parameter specified', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/${organization.didDoc.id}/resolve-vc`,
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'request_validation_failed',
            message: "querystring must have required property 'type'",
            statusCode: 400,
          })
        );
      });

      it('Should 400 with unrecognized type query parameter specified', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/${organization.didDoc.id}/resolve-vc?type=unrecognized`,
        });

        expect(response.statusCode).toEqual(400);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Bad Request',
            errorCode: 'missing_error_code',
            message: 'Unrecognized Verifiable Credential type',
            statusCode: 400,
          })
        );
      });

      it("Should 404 when organization doesn't exist", async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/did:test:whatever/resolve-vc?type=OrganizationBasicProfile-v1.0`,
        });

        expect(response.statusCode).toEqual(404);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Not Found',
            errorCode: 'organization_not_found',
            message: 'Organization not found',
            statusCode: 404,
          })
        );
      });

      it('Should 200 with array of credentials', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/${organization.didDoc.id}/resolve-vc?type=OrganizationBasicProfile-v1.0`,
          headers: {
            'x-override-oauth-user': JSON.stringify({}),
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual([
          {
            format: 'jwt_vc',
            vc: expect.any(String),
          },
        ]);
      });

      it('Should 200 when using did from alsoKnownAs', async () => {
        const alsoKnownAs = 'did:aka:foo';
        await persistOrganization({ alsoKnownAs });
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/${alsoKnownAs}/resolve-vc?type=OrganizationBasicProfile-v1.0`,
          headers: {
            'x-override-oauth-user': JSON.stringify({}),
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual([
          {
            format: 'jwt_vc',
            vc: expect.any(String),
          },
        ]);
      });

      it('Should 200 with empty array if signedCredential is empty', async () => {
        const ownOrg = await persistOrganization({
          signedProfileVcJwt: {},
        });
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/${ownOrg.didDoc.id}/resolve-vc?type=OrganizationBasicProfile-v1.0`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual([]);
      });
    });

    describe('Organization Verifiable Credential Retrieval by Id', () => {
      let organization;
      before(async () => {
        await clearDb();
        organization = await persistOrganization();
      });

      it("Should 404 when organization doesn't exist", async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/missing-did/resolve-vc/missing-vc-id`,
        });

        expect(response.statusCode).toEqual(404);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Not Found',
            errorCode: 'organization_not_found',
            message: 'Organization not found',
            statusCode: 404,
          })
        );
      });

      it("Should 404 when verifiable credential doesn't exist", async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/${organization.didDoc.id}/resolve-vc/missing-vc-id`,
        });

        expect(response.statusCode).toEqual(404);
        expect(response.json).toEqual(
          errorResponseMatcher({
            error: 'Not Found',
            errorCode: 'missing_error_code',
            message: 'Verifiable Credential not found',
            statusCode: 404,
          })
        );
      });

      it('Should 200 with verifiable credential', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: organization.verifiableCredentialJwt,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          format: 'jwt_vc',
          vc: expect.any(String),
        });
      });

      it('Should 200 when using did from alsoKnownAs', async () => {
        const alsoKnownAs = 'did:aka:foo';
        const org = await persistOrganization({ alsoKnownAs });
        const dbOrg = await organizationsRepo.findOne(
          {
            _id: org._id,
          },
          {
            signedProfileVcJwt: 1,
          }
        );

        const url = `${baseUrl}/${alsoKnownAs}/resolve-vc/${dbOrg.signedProfileVcJwt.credentialId}`;
        const response = await fastify.injectJson({
          method: 'GET',
          url,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          format: 'jwt_vc',
          vc: expect.any(String),
        });
      });
    });

    describe('Single Organization Verified Profile Retrieval by Id', () => {
      let organization;
      before(async () => {
        await clearDb();
        organization = await persistOrganization();
      });

      afterEach(() => {
        fastify.resetOverrides();
      });

      it('Should return 404 when organization for profile not found', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/did:test:not-found/verified-profile`,
        });

        expect(response.statusCode).toEqual(404);
      });

      it('Should return an organization profile', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/${organization.didDoc.id}/verified-profile`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          credentialChecks: {
            TRUSTED_ISSUER: 'PASS',
            UNEXPIRED: 'NOT_APPLICABLE',
            UNREVOKED: 'NOT_CHECKED',
            UNTAMPERED: 'PASS',
            checked: expect.stringMatching(ISO_DATETIME_FORMAT),
          },
          credentialSubject: {
            ...publicProfileMatcher(organization.profile),
            id: organization.didDoc.id,
          },
          id: expect.any(String),
          issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          issuer: {
            id: fastify.config.rootDid,
          },
          type: ['OrganizationBasicProfile-v1.0', 'VerifiableCredential'],
        });
      });

      it('Should 200 when using did from alsoKnownAs and adjust profile properties according to did parameter', async () => {
        const alsoKnownAs = 'did:aka:foo';
        const alsoKnownAsOrg = await persistOrganization({ alsoKnownAs });
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/${alsoKnownAs}/verified-profile`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          credentialChecks: {
            TRUSTED_ISSUER: 'PASS',
            UNEXPIRED: 'NOT_APPLICABLE',
            UNREVOKED: 'NOT_CHECKED',
            UNTAMPERED: 'PASS',
            checked: expect.stringMatching(ISO_DATETIME_FORMAT),
          },
          credentialSubject: {
            ...publicProfileMatcher(alsoKnownAsOrg.profile),
            id: alsoKnownAs,
            alsoKnownAs: [alsoKnownAsOrg.didDoc.id],
          },
          id: expect.any(String),
          issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          issuer: {
            id: fastify.config.rootDid,
          },
          type: ['OrganizationBasicProfile-v1.0', 'VerifiableCredential'],
        });
      });

      it('Should return an organization profile without technical and contact email', async () => {
        const newOrg = await persistOrganization({
          name: 'Org987',
          skipTechnicalEmail: true,
          skipContactEmail: true,
        });
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/${newOrg.didDoc.id}/verified-profile`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json.credentialSubject.technicalEmail).toBeUndefined();
        expect(response.json.credentialSubject.contactEmail).toBeUndefined();
      });

      it('Should return an organization profile without signatory and admin properties', async () => {
        const additionalProfileProperties = {
          adminGivenName: 'A-given-name',
          adminFamilyName: 'A-family-name',
          adminTitle: 'A-title',
          adminEmail: 'admin@email.com',
          signatoryGivenName: 'S-given-name',
          signatoryFamilyName: 'S-family-name',
          signatoryTitle: 'S-title',
          signatoryEmail: 'signatory@email.com',
        };
        const newOrg = await newOrganization();
        const orgProfile = omit(
          ['id', 'createdAt', 'updatedAt'],
          newOrg.profile
        );
        const org = await persistOrganization({
          service: [
            {
              id: '#credentialagent-999',
              type: ServiceTypes.CareerIssuerType,
              credentialTypes: ['EducationDegree'],
              serviceEndpoint:
                'https://agent.samplevendor.com/acme/api/999/get-credential-manifest',
            },
          ],
          profile: {
            ...orgProfile,
            ...additionalProfileProperties,
          },
        });
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/${org.didDoc.id}/verified-profile`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          credentialChecks: {
            TRUSTED_ISSUER: 'PASS',
            UNEXPIRED: 'NOT_APPLICABLE',
            UNREVOKED: 'NOT_CHECKED',
            UNTAMPERED: 'PASS',
            checked: expect.stringMatching(ISO_DATETIME_FORMAT),
          },
          credentialSubject: {
            ...publicProfileMatcher(org.profile),
            id: org.didDoc.id,
          },
          id: expect.any(String),
          issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          issuer: {
            id: fastify.config.rootDid,
          },
          type: ['OrganizationBasicProfile-v1.0', 'VerifiableCredential'],
        });
      });

      it('Should return an organization profile without description and emails', async () => {
        const newOrg = await newOrganization();
        const expectedOrg = await persistOrganization({
          profile: omit(
            ['description', 'contactEmail', 'technicalEmail'],
            newOrg.profile
          ),
        });
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/${expectedOrg.didDoc.id}/verified-profile`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          credentialChecks: {
            TRUSTED_ISSUER: 'PASS',
            UNEXPIRED: 'NOT_APPLICABLE',
            UNREVOKED: 'NOT_CHECKED',
            UNTAMPERED: 'PASS',
            checked: expect.stringMatching(ISO_DATETIME_FORMAT),
          },
          credentialSubject: {
            ...publicProfileMatcher(expectedOrg.profile),
            id: expectedOrg.didDoc.id,
          },
          id: expect.any(String),
          issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          issuer: {
            id: fastify.config.rootDid,
          },
          type: ['OrganizationBasicProfile-v1.0', 'VerifiableCredential'],
        });
      });

      it('Should return an organization profile with commercialEntities', async () => {
        const newOrg = await newOrganization({
          commercialEntities: [
            {
              type: 'Brand',
              name: 'commercialName',
              logo: 'http://img.com/commercialLogo.png',
            },
          ],
        });
        const expectedOrg = await persistOrganization({
          profile: omit(
            ['description', 'contactEmail', 'technicalEmail'],
            newOrg.profile
          ),
        });
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/${expectedOrg.didDoc.id}/verified-profile`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          credentialChecks: {
            TRUSTED_ISSUER: 'PASS',
            UNEXPIRED: 'NOT_APPLICABLE',
            UNREVOKED: 'NOT_CHECKED',
            UNTAMPERED: 'PASS',
            checked: expect.stringMatching(ISO_DATETIME_FORMAT),
          },
          credentialSubject: {
            ...publicProfileMatcher({
              ...expectedOrg.profile,
              commercialEntities: [
                {
                  type: 'Brand',
                  name: 'commercialName',
                  logo: 'http://img.com/commercialLogo.png',
                },
              ],
            }),
            id: expectedOrg.didDoc.id,
          },
          id: expect.any(String),
          issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          issuer: {
            id: fastify.config.rootDid,
          },
          type: ['OrganizationBasicProfile-v1.0', 'VerifiableCredential'],
        });
      });

      it('should return credential check failures if root jwk is incorrect', async () => {
        const rootPrivateKey = generateKeyPair().publicKey;

        fastify.overrides.reqConfig = (config) => ({
          ...config,
          rootPrivateKey,
        });

        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/${organization.didDoc.id}/verified-profile`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          credentialChecks: {
            TRUSTED_ISSUER: CheckResults.NOT_CHECKED,
            UNEXPIRED: CheckResults.NOT_CHECKED,
            UNREVOKED: CheckResults.NOT_CHECKED,
            UNTAMPERED: CheckResults.FAIL,
            checked: expect.stringMatching(ISO_DATETIME_FORMAT),
          },
          credentialSubject: {
            ...publicProfileMatcher(organization.profile),
            id: organization.didDoc.id,
          },
          id: expect.any(String),
          issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          issuer: {
            id: fastify.config.rootDid,
          },
          type: ['OrganizationBasicProfile-v1.0', 'VerifiableCredential'],
        });
      });
    });
  });

  describe('Non-custodied DID:WEB test suites', () => {
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
    };
    let organization;
    beforeEach(async () => {
      nock.cleanAll();
      await clearDb();
      organization = await persistOrganization({
        service: [
          {
            id: '#acme',
            type: ServiceTypes.CredentialAgentOperatorType,
            serviceEndpoint: 'https://agent.samplevendor.com/acme',
          },
        ],
        name: 'Did web org',
        didDocId: expectedDidWebDoc.id,
        didNotCustodied: true,
      });
    });

    describe('Organization Profile Modification', () => {
      it('Should update organization profile', async () => {
        const updatedName = 'NAME_UPDATE';
        const payload = {
          ...omit(['name', 'website'])(organization.profile),
          name: updatedName,
        };

        const response = await fastify.injectJson({
          method: 'PUT',
          url: `${baseUrl}/profile/${organization.didDoc.id}`,
          payload,
        });

        expect(response.statusCode).toEqual(200);
        const orgFromDb = await getOrganizationFromDb(organization.didDoc.id);
        expect(orgFromDb.profile).toEqual({
          ...organization.profile,
          name: updatedName,
        });

        const credentialPayload = decodeCredentialJwt(
          orgFromDb.signedProfileVcJwt.signedCredential
        );
        expect(credentialPayload).toEqual({
          credentialSubject: {
            ...publicProfileMatcher({
              ...organization.profile,
              name: updatedName,
            }),
            id: orgFromDb.didDoc.id,
          },
          id: expect.stringMatching(UUID_FORMAT),
          issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          issuer: {
            id: fastify.config.rootDid,
          },
          type: ['OrganizationBasicProfile-v1.0', 'VerifiableCredential'],
        });
      });
    });
    describe('GET Organization DID Doc', () => {
      it('Should throw error for non custodied organization', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/${organization.didDoc.id}`,
        });

        expect(response.statusCode).toEqual(404);
        expect(response.json).toStrictEqual(
          errorResponseMatcher({
            error: 'Not Found',
            errorCode: 'missing_error_code',
            message: 'Organization not found',
            statusCode: 404,
          })
        );
      });
    });
    describe('GET Full Organization', () => {
      it('Should return an organization', async () => {
        await organizationsRepo.addService(new ObjectId(organization._id), {
          id: '#service-2',
          type: ServiceTypes.CareerIssuerType,
          serviceEndpoint: 'https://example1.com',
        });
        await organizationsRepo.addService(new ObjectId(organization._id), {
          id: '#service-3',
          type: ServiceTypes.InspectionType,
          serviceEndpoint: 'https://example2.com',
        });
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${fullUrl}/${organization.didDoc.id}`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual(
          buildFullOrganizationResponse({
            organization,
            services: [
              {
                id: '#acme',
                type: ServiceTypes.CredentialAgentOperatorType,
                serviceEndpoint: 'https://agent.samplevendor.com/acme',
              },
              {
                id: '#service-2',
                type: ServiceTypes.CareerIssuerType,
                serviceEndpoint: 'https://example1.com',
              },
              {
                id: '#service-3',
                type: ServiceTypes.InspectionType,
                serviceEndpoint: 'https://example2.com',
              },
            ],
          })
        );
      });

      it('Should return an organization where did encoded by encode did uri component', async () => {
        organization = await persistOrganization({
          service: [
            {
              id: '#service-1',
              type: ServiceTypes.CredentialAgentOperatorType,
              serviceEndpoint: 'https://example1.com',
            },
            {
              id: '#service-2',
              type: ServiceTypes.CredentialAgentOperatorType,
              serviceEndpoint: 'https://example2.com',
            },
          ],
          name: 'Did web org',
          didDocId: 'did:web:example.io/test:den4',
        });
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${fullUrl}/did:web:example.io%2Ftest:den4`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual(
          buildFullOrganizationResponse({
            organization,
            services: map(
              omit(['createdAt', 'updatedAt']),
              organization.services
            ),
          })
        );
      });
    });
    describe('Organization Verified Profile', () => {
      it('Should return an organization profile', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/${organization.didDoc.id}/verified-profile`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          credentialChecks: {
            TRUSTED_ISSUER: 'PASS',
            UNEXPIRED: 'NOT_APPLICABLE',
            UNREVOKED: 'NOT_CHECKED',
            UNTAMPERED: 'PASS',
            checked: expect.stringMatching(ISO_DATETIME_FORMAT),
          },
          credentialSubject: {
            ...publicProfileMatcher(organization.profile),
            id: organization.didDoc.id,
          },
          id: expect.any(String),
          issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
          issuer: {
            id: fastify.config.rootDid,
          },
          type: ['OrganizationBasicProfile-v1.0', 'VerifiableCredential'],
        });
      });
    });
  });
});
