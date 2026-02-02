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

const { flow, map, kebabCase, omit, reverse, forEach } = require('lodash/fp');
const { nanoid } = require('nanoid');
const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { mapWithIndex, runSequentially } = require('@verii/common-functions');
const { testReadOrganizationsUser } = require('@verii/tests-helpers');
const { ServiceTypes } = require('@verii/organizations-registry');

const { generateKeyPair } = require('@verii/crypto');
const initOrganizationFactory = require('../src/entities/organizations/factories/organizations-factory');
const initGroupsFactory = require('../src/entities/groups/factories/groups-factory');
const buildFastify = require('./helpers/build-fastify');

const {
  ProfileFieldsForHide,
  buildPublicService,
  convertIssuer,
  VNF_GROUP_ID_CLAIM,
} = require('../src/entities');

const baseUrl = '/api/v0.6/organizations';

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
    profile,
  );

const searchResult = (org, services = [], transformServices = true) => {
  const { profile, verifiableCredentialJwt, didDoc } = org;
  const [targetService] = services;
  const service =
    transformServices === true && targetService
      ? convertIssuer(didDoc)(targetService)
      : targetService;
  return {
    id: didDoc.id,
    alsoKnownAs: didDoc.alsoKnownAs,
    ...publicProfileMatcher(profile),
    verifiableCredentialJwt,
    service: targetService ? [buildPublicService(service)] : [],
  };
};

describe('Organizations Test Suite', () => {
  let fastify;
  let persistOrganization;
  let newOrganization;
  let persistGroup;
  const persistIndexedOrganizationWithIssuerService = async (identifier) => {
    const service = {
      type: ServiceTypes.CareerIssuerType,
      credentialTypes: ['EducationDegree'],
      serviceEndpoint: `https://agent.samplevendor.com/acme/api/${identifier}/get-credential-manifest`,
    };
    return persistIndexedOrganizationWithServices(identifier, [service]);
  };

  const persistIndexedOrganizationWithServices = async (
    identifier,
    services,
  ) => {
    const newServices = mapWithIndex((service, idx) => {
      return {
        id: `#${kebabCase(service.type.slice(0, -3))}-${idx + 1}`,
        ...service,
      };
    }, services);
    const organization = await persistOrganization({
      service: newServices,
      name: `Test Organization${identifier}`,
      commercialEntities: [
        {
          type: 'Brand',
          name: `commercialName ${identifier}`,
          logo: 'http://img.com/commercialLogo.png',
        },
      ],
    });
    return {
      organization,
      services: organization.services,
    };
  };

  const clearDb = async () => {
    await mongoDb().collection('organizations').deleteMany({});
    await mongoDb().collection('organizationKeys').deleteMany({});
    await mongoDb().collection('groups').deleteMany({});
  };

  before(async () => {
    fastify = buildFastify();
    await fastify.ready();
    ({ persistOrganization, newOrganization } =
      initOrganizationFactory(fastify));
    ({ persistGroup } = initGroupsFactory(fastify));
  });

  after(async () => {
    await fastify.close();
  });

  describe('GET DID Doc of Organizations', () => {
    describe('Empty State', () => {
      before(async () => {
        await clearDb();
      });

      it('Should return an empty list when there are no organizations', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: baseUrl,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({ result: [] });
      });
    });

    describe('Single Organization State', () => {
      let organization;
      before(async () => {
        await clearDb();
        ({ organization } =
          await persistIndexedOrganizationWithIssuerService(0));
      });

      it('Should return a list with items when there is at least one organization', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: baseUrl,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({ result: [organization.didDoc] });
      });
    });

    describe('GET Organization Did Docs authorization filter tests', () => {
      let orgs;
      before(async () => {
        await clearDb();
        const result = await runSequentially([
          () => persistIndexedOrganizationWithIssuerService(0),
          () => persistIndexedOrganizationWithIssuerService(1),
        ]);
        orgs = map(({ organization }) => organization, result);
      });

      it('Should return an empty list when user group is different', async () => {
        const userGroup = await persistGroup({ groupId: nanoid(), dids: [] });
        const response = await fastify.injectJson({
          method: 'GET',
          url: baseUrl,
          headers: {
            'x-override-oauth-user': JSON.stringify({
              ...testReadOrganizationsUser,
              [VNF_GROUP_ID_CLAIM]: userGroup.groupId,
            }),
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: [],
        });
      });
      it("Should return a list of only organizations that user's group contains", async () => {
        await persistGroup({ organization: orgs[0] });
        const response = await fastify.injectJson({
          method: 'GET',
          url: baseUrl,
          headers: {
            'x-override-oauth-user': JSON.stringify(testReadOrganizationsUser),
          },
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: [orgs[0].didDoc],
        });
      });
    });
  });

  describe('Search Organization Profiles', () => {
    describe('Empty State', () => {
      before(async () => {
        await clearDb();
      });

      it('Should return an empty list when there are no organizations', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({ result: [] });
      });
      it('Should return an empty list when there are no organizations and noServiceEndpointTransform is set', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles?no-service-endpoint-transform=1`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({ result: [] });
      });
    });

    describe('Single Organization State', () => {
      let organization;
      let services;
      beforeEach(async () => {
        await clearDb();
        ({ organization, services } =
          await persistIndexedOrganizationWithIssuerService(0));
      });

      it('Should return a list with items when there is at least one organization', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: [searchResult(organization, services)],
        });
      });

      it('Should return a list with items when there are no admin and signatory properties in the profile', async () => {
        await clearDb();
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
          newOrg.profile,
        );
        const service = {
          id: '#credentialagent-999',
          type: ServiceTypes.CareerIssuerType,
          serviceEndpoint:
            'https://agent.samplevendor.com/acme/api/999/get-credential-manifest',
          credentialTypes: ['EducationDegree'],
        };
        const org = await persistOrganization({
          service: [service],
          profile: {
            ...orgProfile,
            ...additionalProfileProperties,
          },
        });
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles`,
        });

        const orgResponse = searchResult(org, [service]);
        expect(response.statusCode).toEqual(200);

        expect(response.json).toEqual({
          result: [omit(ProfileFieldsForHide, orgResponse)],
        });
      });

      it('Should return a organization with commercialEntities in the profile', async () => {
        const org = await persistOrganization({
          service: [],
          name: 'commercial entities organization',
          commercialEntities: [
            {
              type: 'Brand',
              name: 'commercialName',
              logo: 'http://img.com/commercialLogo.png',
            },
          ],
        });
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: [
            searchResult(
              {
                ...org,
                profile: {
                  ...org.profile,
                  commercialEntities: [
                    {
                      type: 'Brand',
                      name: 'commercialName',
                      logo: 'http://img.com/commercialLogo.png',
                    },
                  ],
                },
              },
              [],
              false,
            ),
            searchResult(organization, services),
          ],
        });
      });

      it('Should return empty if the organization doesnt have activated services', async () => {
        await mongoDb()
          .collection('organizations')
          .updateMany(
            {
              'didDoc.id': organization.didDoc.id,
            },
            { $set: { activatedServiceIds: [] } },
          );

        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles`,
        });

        expect(response.statusCode).toEqual(200);
        const result = searchResult(organization, [], false);
        expect(response.json).toEqual({
          result: [{ ...result, service: [] }],
        });
      });

      it('Should not retrieve deleted organizations', async () => {
        await persistOrganization({ deletedAt: Date('2023-02-27T14:40:18') });
        const response = await fastify.injectJson({
          method: 'GET',
          url: baseUrl,
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json.result).toHaveLength(1);
        expect(response.json.result[0].id).toEqual(organization.didDoc.id);
      });

      it('Should not retrieve deleted organization', async () => {
        await persistOrganization({ deletedAt: Date('2023-02-27T14:40:18') });
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles`,
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json.result).toHaveLength(1);
        expect(response.json.result[0].id).toEqual(organization.didDoc.id);
      });

      it('Should return a list with correctly generated service endpoint', async () => {
        const newOrganization1 = await persistOrganization({
          service: [
            {
              credentialTypes: ['EducationDegree'],
              id: '#credentialagent-999',
              type: ServiceTypes.CareerIssuerType,
              serviceEndpoint: 'https://agent.samplevendor987.com////',
            },
          ],
          name: '1Organization',
        });
        const newOrganization2 = await persistOrganization({
          service: [
            {
              id: '#credentialagent-999',
              type: ServiceTypes.CareerIssuerType,
              serviceEndpoint: 'https://agent.samplevendor127.com',
              credentialTypes: ['EducationDegree'],
            },
          ],
          name: '1Organization',
        });
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles`,
        });

        expect(response.statusCode).toEqual(200);

        expect(response.json).toEqual({
          result: [
            {
              id: newOrganization2.didDoc.id,
              ...publicProfileMatcher(newOrganization2.profile),
              verifiableCredentialJwt: newOrganization2.verifiableCredentialJwt,
              service: [
                {
                  ...omit(
                    ['updatedAt', 'createdAt'],
                    newOrganization2.services[0],
                  ),
                  // eslint-disable-next-line max-len
                  serviceEndpoint: `https://agent.samplevendor127.com/api/holder/v0.6/org/${newOrganization2.didDoc.id}/issue/get-credential-manifest`,
                },
              ],
            },
            {
              id: newOrganization1.didDoc.id,
              ...publicProfileMatcher(newOrganization1.profile),
              verifiableCredentialJwt: newOrganization1.verifiableCredentialJwt,
              service: [
                {
                  ...omit(
                    ['updatedAt', 'createdAt'],
                    newOrganization1.services[0],
                  ),
                  // eslint-disable-next-line max-len
                  serviceEndpoint: `https://agent.samplevendor987.com/api/holder/v0.6/org/${newOrganization1.didDoc.id}/issue/get-credential-manifest`,
                },
              ],
            },
            {
              id: organization.didDoc.id,
              ...publicProfileMatcher(organization.profile),
              verifiableCredentialJwt: organization.verifiableCredentialJwt,
              service: [
                {
                  ...omit(['updatedAt', 'createdAt'], organization.services[0]),
                  serviceEndpoint:
                    'https://agent.samplevendor.com/acme/api/0/get-credential-manifest',
                },
              ],
            },
          ],
        });
      });

      it('should return a list without technical and contact email in profile', async () => {
        await clearDb();
        await persistOrganization({
          service: [
            {
              id: '#credentialagent-999',
              type: ServiceTypes.CareerIssuerType,
              credentialTypes: ['EducationDegree'],
              serviceEndpoint: 'https://agent.samplevendor987.com////',
            },
          ],
          name: '1Organization',
          skipTechnicalEmail: true,
          skipContactEmail: true,
        });

        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles`,
        });

        expect(response.statusCode).toEqual(200);

        expect(response.json.result[0].technicalEmail).toBeUndefined();
        expect(response.json.result[0].contactEmail).toBeUndefined();
      });
    });

    describe('Organizations retrieval filtering tests', () => {
      let orgs;
      let servicesByOrg = {};
      beforeEach(async () => {
        await clearDb();

        const serviceIssuer = {
          type: ServiceTypes.CareerIssuerType,
          credentialTypes: ['EducationDegree'],
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };

        const serviceInspector = {
          type: ServiceTypes.InspectionType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };

        const serviceWebWalletProvider = {
          type: ServiceTypes.WebWalletProviderType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
          playStoreUrl: 'http://example.com/play-store',
          appleAppStoreUrl: 'http://example.com/apple-app-store',
          appleAppId: 'com.example.app',
          googlePlayId: 'com.example.app',
          logoUrl: 'http://example.com/logo',
          name: 'fooWallet',
          supportedExchangeProtocols: ['VN_API'],
        };
        const result = await runSequentially([
          () => persistIndexedOrganizationWithServices(0, [serviceIssuer]),
          () => persistIndexedOrganizationWithServices(1, [serviceInspector]),
          () => persistIndexedOrganizationWithServices('00', [serviceIssuer]),
          () =>
            persistIndexedOrganizationWithServices('01', [
              serviceWebWalletProvider,
            ]),
        ]);
        orgs = map((org) => org.organization, result);
        servicesByOrg = {};
        forEach(({ organization, services }) => {
          servicesByOrg[organization.didDoc.id] = services;
        }, result);
      });

      it('Should return a list with a single item when only "q" param is provided', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles?q=Organization1`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: [searchResult(orgs[1], servicesByOrg[orgs[1].didDoc.id])],
        });
      });

      it('Should return a list with all matching organizations with partial text "q" param is provided', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles?q=Organization0`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: map(
            (org) => searchResult(org, servicesByOrg[org.didDoc.id]),
            [orgs[3], orgs[2], orgs[0]],
          ),
        });
      });

      it('Should return a list with org services fully resolved', async () => {
        const serviceCao = {
          id: '#cao-service',
          type: ServiceTypes.CredentialAgentOperatorType,
          serviceEndpoint: 'https://agent.samplecao.com/cao',
        };
        const caoOrg = await persistOrganization({
          service: [serviceCao],
          name: 'CAO Organization',
        });

        const issuingService = {
          type: ServiceTypes.CareerIssuerType,
          credentialTypes: ['EducationDegree'],
          serviceEndpoint: `${caoOrg.didDoc.id}#cao-service`,
          id: '#issuing-service',
        };

        const issuingOrg = await persistOrganization({
          service: [issuingService],
          name: 'IssuingToCAO',
        });

        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles?q=IssuingToCAO`,
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: map(
            (org) =>
              searchResult(
                org,
                [
                  {
                    ...issuingService,
                    ...issuingService.didDocumentService,
                    serviceEndpoint: 'https://agent.samplecao.com/cao',
                  },
                ],
                true,
              ),
            [issuingOrg],
          ),
        });
      });

      it('Should return a list with org services fully resolved via alias', async () => {
        const caoAlsoKnownAs = 'did:test:caoaka';
        const serviceCao = {
          id: '#cao-service',
          type: ServiceTypes.CredentialAgentOperatorType,
          serviceEndpoint: 'https://agent.samplecao.com/cao',
        };
        await persistOrganization({
          service: [serviceCao],
          alsoKnownAs: caoAlsoKnownAs,
          name: 'CAO Organization',
        });

        const issuingService = {
          type: ServiceTypes.CareerIssuerType,
          credentialTypes: ['EducationDegree'],
          serviceEndpoint: `${caoAlsoKnownAs}#cao-service`,
          id: '#issuing-service',
        };

        const issuingOrg = await persistOrganization({
          service: [issuingService],
          name: 'IssuingToCAO',
        });

        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles?q=IssuingToCAO`,
        });
        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: map(
            (org) =>
              searchResult(
                org,
                [
                  {
                    ...issuingService,
                    ...issuingService.didDocumentService,
                    serviceEndpoint: 'https://agent.samplecao.com/cao',
                  },
                ],
                true,
              ),
            [issuingOrg],
          ),
        });
      });

      it('Should return a list with org services pointing to unresolved did filtered out', async () => {
        const issuingService = {
          type: ServiceTypes.CareerIssuerType,
          serviceEndpoint: 'did:foo:bar#cao-service',
          id: '#issuing-service',
          credentialTypes: ['EducationDegree'],
        };

        const issuingOrg = await persistOrganization({
          service: [issuingService],
          name: 'IssuingToCAO',
        });

        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles?q=IssuingToCAO`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: map(
            (org) =>
              searchResult(org, [
                { ...issuingService, ...issuingService.didDocumentService },
              ]),
            [issuingOrg],
          ),
        });
      });

      it('Should return a list with org services pointing to unresolved did service filtered out', async () => {
        const caoOrg = await persistOrganization({
          service: [],
          name: 'CAO Organization',
        });

        const issuingService = {
          type: ServiceTypes.CareerIssuerType,
          serviceEndpoint: `${caoOrg.didDoc.id}#cao-service`,
          id: '#issuing-service',
          credentialTypes: ['EducationDegree'],
        };

        const issuingOrg = await persistOrganization({
          service: [issuingService],
          name: 'IssuingToCAO',
        });

        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles?q=IssuingToCAO`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: map(
            (org) =>
              searchResult(org, [
                { ...issuingService, ...issuingService.didDocumentService },
              ]),
            [issuingOrg],
          ),
        });
      });

      it('Should return a list with org services not fully resolved', async () => {
        const serviceCao = {
          id: '#cao-service',
          type: ServiceTypes.CredentialAgentOperatorType,
          serviceEndpoint: 'https://agent.samplecao.com/cao',
        };
        const caoOrg = await persistOrganization({
          service: [serviceCao],
          name: 'CAO Organization',
        });

        const issuingService = {
          type: ServiceTypes.CareerIssuerType,
          serviceEndpoint: `${caoOrg.didDoc.id}#cao-service`,
          id: '#issuing-service',
          credentialTypes: ['EducationDegree'],
        };

        const issuingOrg = await persistOrganization({
          service: [issuingService],
          name: 'IssuingToCAO',
        });

        const legacyIssuingService = {
          id: '#legacy-issuing-service',
          type: ServiceTypes.CareerIssuerType,
          serviceEndpoint: 'https://agent.com/legacy-issuer',
        };
        const legacyIssuingOrg = await persistOrganization({
          service: [legacyIssuingService],
          name: 'IssuingToCAO2',
        });

        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles?q=IssuingToCAO&no-service-endpoint-transform=1`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: map(
            ([org, service]) =>
              searchResult(
                org,
                [{ ...service, ...service.didDocumentService }],
                false,
              ),
            [
              [legacyIssuingOrg, legacyIssuingService],
              [issuingOrg, issuingService],
            ],
          ),
        });
      });

      it('Should return a list with an item when only "filter.serviceTypes" param is provided', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles?filter.serviceTypes=Issuer`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: map(
            (org) => searchResult(org, servicesByOrg[org.didDoc.id]),
            [orgs[2], orgs[0]],
          ),
        });
      });

      it('Should return a list with a single item when "q" param is provided along with other filters', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles?q=Organization00&filter.serviceTypes=Issuer`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: [searchResult(orgs[2], servicesByOrg[orgs[2].didDoc.id])],
        });
      });

      it('Should return a list with an item when only "filter.did" param is provided', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles?filter.did=${orgs[1].didDoc.id}`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: [searchResult(orgs[1], servicesByOrg[orgs[1].didDoc.id])],
        });
      });

      it('Should return a list matching a did and an alsoKnownAs did', async () => {
        const alsoKnownAs = 'did:test:aka1';
        const service = {
          id: '#aka-issuer',
          type: ServiceTypes.CareerIssuerType,
          credentialTypes: ['EducationDegree'],
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };
        const organization = await persistOrganization({
          alsoKnownAs,
          service: [service],
        });
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles?filter.did=${orgs[1].didDoc.id}&filter.did=${alsoKnownAs}`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: [
            {
              ...searchResult(organization, [service]),
              id: alsoKnownAs,
              alsoKnownAs: [organization.didDoc.id],
              service: [
                {
                  ...service,
                  serviceEndpoint: `${service.serviceEndpoint}/api/holder/v0.6/org/${alsoKnownAs}/issue/get-credential-manifest`,
                },
              ],
            },
            searchResult(orgs[1], servicesByOrg[orgs[1].didDoc.id]),
          ],
        });
      });

      it('Should return an org and default to did alias when alias is present and query does not specify a did:web', async () => {
        const alsoKnownAs = 'did:test:aka1';
        const did = 'did:web:foo';
        const service = {
          id: '#aka-issuer',
          type: ServiceTypes.CareerIssuerType,
          credentialTypes: ['EducationDegree'],
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };
        const organization = await persistOrganization({
          alsoKnownAs,
          did,
          service: [service],
        });
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles?sort[0]=createdAt,DESC&page.size=1&filter.serviceTypes=Issuer,NotaryIssuer`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: [
            {
              ...searchResult(organization, [service]),
              id: alsoKnownAs,
              alsoKnownAs: [did],
              service: [
                {
                  ...service,
                  serviceEndpoint: `${service.serviceEndpoint}/api/holder/v0.6/org/${alsoKnownAs}/issue/get-credential-manifest`,
                },
              ],
            },
          ],
        });
      });

      it('Should return a list including disparate service types without any issuer credential types specified', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles?filter.serviceTypes=Issuer,Inspector`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: flow(
            map((org) => searchResult(org, servicesByOrg[org.didDoc.id])),
            reverse,
          )([orgs[0], orgs[1], orgs[2]]),
        });
      });

      it('Should return a list including disparate service types with issuer credential types and wallet fields specified', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles?filter.serviceTypes=Issuer,Inspector,HolderAppProvider&filter.credentialTypes=EducationDegree`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: flow(
            map((org) => searchResult(org, servicesByOrg[org.didDoc.id])),
            reverse,
          )(orgs),
        });
      });

      it('Should return a list with matching "filter.serviceTypes" and only activated services', async () => {
        const service = [
          {
            id: '#identityIssuer-1',
            type: ServiceTypes.IdDocumentIssuerType,
            serviceEndpoint: 'https://node.example.com',
          },
          {
            id: '#careerIssuer-2',
            type: ServiceTypes.CareerIssuerType,
            serviceEndpoint: 'https://node.example.com',
          },
        ];

        const org = await persistOrganization({
          service,
          activatedServiceIds: ['#careerIssuer-2'],
        });
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles?filter.serviceTypes=Issuer`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: map(
            (_org) =>
              searchResult(_org, servicesByOrg[_org.didDoc.id] || [service[1]]),
            [
              {
                ...org,
                ...{ didDoc: { ...org.didDoc, service: [service[1]] } },
              },
              orgs[2],
              orgs[0],
            ],
          ),
        });
      });

      it('Should not return a list with an items when provided "filter.serviceTypes" param is not match with eatch item', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles?filter.serviceTypes=NodeOperator`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: [],
        });
      });
    });

    describe('Organizations Retrieval Sort Tests', () => {
      let orgs;
      before(async () => {
        await clearDb();

        const serviceIssuer = {
          type: ServiceTypes.CareerIssuerType,
          credentialTypes: ['EducationDegree'],
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };

        const result = await runSequentially([
          () => persistIndexedOrganizationWithServices(3, [serviceIssuer]),
          () => persistIndexedOrganizationWithServices('b', [serviceIssuer]),
          () => persistIndexedOrganizationWithServices(2, [serviceIssuer]),
          () => persistIndexedOrganizationWithServices('a', [serviceIssuer]),
          () => persistIndexedOrganizationWithServices(1, [serviceIssuer]),
          () => persistIndexedOrganizationWithServices('c', [serviceIssuer]),
        ]);
        orgs = map((org) => org.organization, result);
      });

      it('Should 400 when the "sort" param is not an array', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles?sort=asd`,
        });

        expect(response.statusCode).toEqual(400);
      });

      it('Should 200 "sort[0]=createdAt,DESC" query with most recent organization sorted to first', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles?sort[0]=createdAt,DESC`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json.result).toHaveLength(6);
        expect(response.json.result[5].id).toEqual(orgs[0].didDoc.id);
        expect(response.json.result[0].id).toEqual(orgs[5].didDoc.id);
      });

      it('Should 200 "sort[0]=createdAt,ASC" query with most recent organization sorted to last', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles?sort[0]=createdAt,ASC`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json.result).toHaveLength(6);
        expect(response.json.result[0].id).toEqual(orgs[0].didDoc.id);
        expect(response.json.result[5].id).toEqual(orgs[5].didDoc.id);
      });

      it('Should 200 "sort[0]=profile.name,ASC" query with organizations sorted alphabetically', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles?sort[0]=profile.name,ASC`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json.result).toHaveLength(6);
        expect(response.json.result[0].id).toEqual(orgs[4].didDoc.id);
        expect(response.json.result[5].id).toEqual(orgs[5].didDoc.id);
      });

      it('Should 200 "sort[0]=profile.name,DESC" query with organizations sorted reverse-alphabetically', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles?sort[0]=profile.name,DESC`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json.result).toHaveLength(6);
        expect(response.json.result[5].id).toEqual(orgs[4].didDoc.id);
        expect(response.json.result[0].id).toEqual(orgs[5].didDoc.id);
      });
    });

    describe('Organizations Size and Skip Tests', () => {
      let orgs;
      before(async () => {
        await clearDb();

        const serviceIssuer = {
          type: ServiceTypes.CareerIssuerType,
          credentialTypes: ['EducationDegree'],
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };

        const result = await runSequentially([
          () => persistIndexedOrganizationWithServices(0, [serviceIssuer]),
          () => persistIndexedOrganizationWithServices(1, [serviceIssuer]),
          () => persistIndexedOrganizationWithServices(2, [serviceIssuer]),
        ]);
        orgs = map((org) => org.organization, result);
      });

      it('Should 400 when the "page.size" param is not a number', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles?page.size=a`,
        });

        expect(response.statusCode).toEqual(400);
      });

      it('Should 400 when the "page.skip" param is not a number', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles?page.skip=a`,
        });

        expect(response.statusCode).toEqual(400);
      });

      it('Should 200 with length matching "page.size"', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles?page.size=1`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json.result).toHaveLength(1);
      });

      it('Should 200 with length matching "page.size", and value should match skip with implicit sort (["id","DESC"])', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles?page.size=1&page.skip=2`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json.result).toHaveLength(1);
        expect(response.json.result[0].id).toEqual(orgs[0].didDoc.id);
      });

      it('Should 200 with length matching "page.size", value should match the expected skip when using sort[0]=profile.name,ASC', async () => {
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles?page.size=1&page.skip=2&sort[0]=profile.name,ASC`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json.result).toHaveLength(1);
        expect(response.json.result[0].id).toEqual(orgs[2].didDoc.id);
      });
    });
  });

  describe('Non-custodied DID:WEB test suite', () => {
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
        {
          id: 'did:web:example.com#key-1',
          type: 'JsonWebKey2020',
          controller: 'did:web:example.com',
          publicKeyJwk: keyPair.publicKey,
        },
        {
          id: 'did:web:example.com#key-2',
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
        {
          id: 'did:web:example.com#key-1',
          type: 'JsonWebKey2020',
          controller: 'did:web:example.com',
          publicKeyJwk: keyPair.publicKey,
        },
        {
          id: 'did:web:example.com#key-2',
          type: 'JsonWebKey2020',
          controller: 'did:web:example.com',
          publicKeyJwk: keyPair.publicKey,
        },
      ],
    };

    beforeEach(async () => {
      await clearDb();
    });

    describe('DID:WEB search-profiles', () => {
      it('should return did:web organization', async () => {
        const organization = await persistOrganization({
          name: 'Did web org',
          didDocId: expectedDidWebDoc.id,
          activatedServiceIds: ['#acme'],
          service: [
            {
              credentialTypes: ['IdDocument'],
              id: '#acme',
              type: ServiceTypes.IdDocumentIssuerType,
              serviceEndpoint: 'https://agent.samplevendor.com/acme',
            },
          ],
        });
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: [
            {
              id: organization.didDoc.id,
              ...publicProfileMatcher(organization.profile),
              verifiableCredentialJwt: organization.verifiableCredentialJwt,
              service: [
                {
                  id: '#acme',
                  type: ServiceTypes.IdDocumentIssuerType,
                  serviceEndpoint:
                    'https://agent.samplevendor.com/acme/api/holder/v0.6/org/did:web:example.com/issue/get-credential-manifest',
                  credentialTypes: ['IdDocument'],
                },
              ],
            },
          ],
        });
      });

      it('should return custodied and non custodied organizations', async () => {
        const custodiedOrganization = await persistOrganization({
          service: [
            {
              id: '#mock-1',
              type: ServiceTypes.IdDocumentIssuerType,
              serviceEndpoint: 'https://agent.samplevendor.com/acme',
            },
          ],
          activatedServiceIds: ['#mock-1'],
        });
        const nonCustodiedOrganization = await persistOrganization({
          name: 'Did web org',
          didDocId: expectedDidWebDoc.id,
          service: [
            {
              id: '#acme',
              type: ServiceTypes.IdDocumentIssuerType,
              serviceEndpoint:
                'https://agent.samplevendor.com/acme/api/holder/v0.6/org/did:web:example.com/issue/get-credential-manifest',
            },
          ],
          activatedServiceIds: ['#acme'],
        });
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: [
            {
              id: nonCustodiedOrganization.didDoc.id,
              ...publicProfileMatcher(nonCustodiedOrganization.profile),
              verifiableCredentialJwt:
                nonCustodiedOrganization.verifiableCredentialJwt,
              service: [
                {
                  id: '#acme',
                  type: ServiceTypes.IdDocumentIssuerType,
                  serviceEndpoint:
                    'https://agent.samplevendor.com/acme/api/holder/v0.6/org/did:web:example.com/issue/get-credential-manifest',
                },
              ],
            },
            searchResult(custodiedOrganization, custodiedOrganization.services),
          ],
        });
      });

      it('Should return a list with services where exist particular service type', async () => {
        const custodiedOrganization = await persistOrganization({
          service: [
            {
              id: '#mock-1',
              type: ServiceTypes.IdDocumentIssuerType,
              serviceEndpoint: 'https://agent.samplevendor.com/acme',
            },
            {
              id: '#mock-2',
              type: ServiceTypes.NotaryContactIssuerType,
              serviceEndpoint: 'https://agent.samplevendor.com/acme',
            },
          ],
          activatedServiceIds: ['#mock-1', '#mock-2'],
        });
        const nonCustodiedOrganization = await persistOrganization({
          name: 'Did web org',
          didDocId: expectedDidWebDoc.id,
          service: [
            {
              id: '#acme-1',
              type: ServiceTypes.IdDocumentIssuerType,
              serviceEndpoint: 'https://agent.samplevendor.com/acme',
            },
            {
              id: '#acme-2',
              type: ServiceTypes.NotaryContactIssuerType,
              serviceEndpoint: 'https://agent.samplevendor.com/acme',
            },
          ],
          activatedServiceIds: ['#acme-1', '#acme-2'],
        });
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles?filter.serviceTypes=IdDocumentIssuer`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: [
            {
              id: nonCustodiedOrganization.didDoc.id,
              ...publicProfileMatcher(nonCustodiedOrganization.profile),
              verifiableCredentialJwt:
                nonCustodiedOrganization.verifiableCredentialJwt,
              service: [
                {
                  id: '#acme-1',
                  type: ServiceTypes.IdDocumentIssuerType,
                  serviceEndpoint:
                    'https://agent.samplevendor.com/acme/api/holder/v0.6/org/did:web:example.com/issue/get-credential-manifest',
                },
              ],
            },
            searchResult(custodiedOrganization, custodiedOrganization.services),
          ],
        });
      });

      it('Should not return a list with services where particular service type is not match', async () => {
        await persistOrganization({
          service: [
            {
              id: '#mock-1',
              type: ServiceTypes.IdDocumentIssuerType,
              serviceEndpoint: 'https://agent.samplevendor.com/acme',
            },
            {
              id: '#mock-2',
              type: ServiceTypes.NotaryContactIssuerType,
              serviceEndpoint: 'https://agent.samplevendor.com/acme',
            },
          ],
          activatedServiceIds: ['#mock-1', '#mock-2'],
        });
        await persistOrganization({
          name: 'Did web org',
          didDocId: expectedDidWebDoc.id,
          service: [
            {
              id: '#acme-1',
              type: ServiceTypes.IdDocumentIssuerType,
              serviceEndpoint: 'https://agent.samplevendor.com/acme',
            },
            {
              id: '#acme-2',
              type: ServiceTypes.NotaryContactIssuerType,
              serviceEndpoint: 'https://agent.samplevendor.com/acme',
            },
          ],
          activatedServiceIds: ['#acme-1', '#acme-2'],
        });
        const response = await fastify.injectJson({
          method: 'GET',
          url: `${baseUrl}/search-profiles?filter.serviceTypes=Inspector`,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({
          result: [],
        });
      });
    });

    describe('DID:WEB get organizations', () => {
      it('Should return empty list with organization', async () => {
        const service = {
          id: '#acme',
          type: ServiceTypes.CredentialAgentOperatorType,
          serviceEndpoint: 'https://agent.samplevendor.com/acme',
        };
        await persistOrganization({
          name: 'Did web org',
          didDocId: expectedDidWebDoc.id,
          service: [service],
          didNotCustodied: true,
        });
        const response = await fastify.injectJson({
          method: 'GET',
          url: baseUrl,
        });

        expect(response.statusCode).toEqual(200);
        expect(response.json).toEqual({ result: [] });
      });
    });
  });
});
