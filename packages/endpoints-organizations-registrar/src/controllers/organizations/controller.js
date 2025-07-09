const {
  find,
  first,
  flatMap,
  intersection,
  map,
  mapKeys,
  omit,
  castArray,
  without,
} = require('lodash/fp');
const newError = require('http-errors');
const { prepCamelCase } = require('@verii/common-functions');
const {
  buildDidDocWithAlternativeId,
  getDidAndAliases,
} = require('@verii/did-doc');
const { isWebDid } = require('@verii/did-web');
const {
  verifyUserOrganizationWriteAuthorized,
  verifyUserOrganizationReadAuthorized,
} = require('../../plugins/authorization');
const {
  buildProfileResponse,
  initPrepareProfileVc,
  initTransformOrganizationFilter,
  getServiceTypesFromCategories,
  transformProfileService,
  OrganizationErrorMessages,
  RegistrarScopes,
  normalizeProfileName,
  loadCaoServiceRefs,
  buildPublicProfile,
  synchronizeMonitors,
  validateProfileName,
  validateUpdateProfile,
} = require('../../entities');

const custodiedFinder = (existingFinder) => ({
  ...existingFinder,
  filter: {
    ...existingFinder.filter,
    didNotCustodied: { $ne: true },
  },
});

const organizationController = async (fastify) => {
  const prepareProfileVc = initPrepareProfileVc(fastify);

  fastify
    .get(
      '/search-profiles',
      {
        preHandler: (req, reply, done) => {
          // eslint-disable-next-line better-mutation/no-mutation
          req.query = prepCamelCase(req.query);
          done();
        },
        schema: fastify.autoSchema({
          querystring: { $ref: 'organization-search-profile-query-params#' },
          response: {
            200: {
              type: 'object',
              properties: {
                result: {
                  type: 'array',
                  items: {
                    allOf: [
                      { $ref: 'organization-profile#' },
                      {
                        type: 'object',
                        properties: {
                          service: {
                            type: 'array',
                            items: { $ref: 'did-service#' },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
        }),
      },
      async (req) => {
        const { repos, query } = req;
        const serviceTypes = getServiceTypesFromCategories(query);

        let organizations = await repos.organizations.searchByAggregation(
          query
        );

        organizations = map(
          (org) => organizationWithAlternativeDidDoc(org, req),
          organizations
        );

        const caoServiceRefs = query.noServiceEndpointTransform
          ? {}
          : await loadAllOrgCaoServiceRefs(organizations, req);
        const result = map(
          (organization) => ({
            id: organization.didDoc.id,
            alsoKnownAs: organization.didDoc.alsoKnownAs,
            ...buildPublicProfile(organization.profile),
            verifiableCredentialJwt: organization.verifiableCredentialJwt,
            service: transformProfileService(
              organization,
              organization.services,
              serviceTypes,
              caoServiceRefs,
              req
            ),
          }),
          organizations
        );
        return { result };
      }
    )
    .get(
      '/',
      {
        onRequest: fastify.verifyAccessToken([
          RegistrarScopes.ReadOrganizations,
          RegistrarScopes.AdminOrganizations,
        ]),
        preHandler: [verifyUserOrganizationReadAuthorized],
        schema: fastify.autoSchema({
          security: [
            {
              RegistrarOAuth2: [
                RegistrarScopes.ReadOrganizations,
                RegistrarScopes.AdminOrganizations,
              ],
            },
          ],
          querystring: { $ref: 'organization-search-query-params#' },
          response: {
            200: {
              type: 'object',
              properties: {
                result: {
                  type: 'array',
                  items: { $ref: 'did-doc#' },
                },
              },
            },
          },
        }),
      },
      async (req) => {
        const { repos, query } = req;
        const organizations = await repos.organizations.find(
          custodiedFinder(initTransformOrganizationFilter(query)),
          { didDoc: 1 }
        );
        return {
          result: map('didDoc', organizations),
        };
      }
    )
    .put(
      '/profile/:did',
      {
        onRequest: fastify.verifyAccessToken([
          RegistrarScopes.AdminOrganizations,
          RegistrarScopes.WriteOrganizations,
        ]),
        preHandler: [verifyUserOrganizationWriteAuthorized],
        schema: fastify.autoSchema({
          security: [
            {
              RegistrarOAuth2: [
                RegistrarScopes.WriteOrganizations,
                RegistrarScopes.AdminOrganizations,
              ],
            },
          ],
          body: {
            $ref: 'organization-profile-update#',
          },
          response: {
            200: {
              allOf: [
                {
                  $ref: 'organization-profile#',
                },
                {
                  type: 'object',
                  properties: {
                    createdAt: {
                      type: 'string',
                      format: 'date-time',
                    },
                    updatedAt: {
                      type: 'string',
                      format: 'date-time',
                    },
                  },
                  required: ['updatedAt', 'createdAt'],
                },
              ],
            },
            400: {
              $ref: 'error#',
            },
          },
        }),
      },
      async (req) => {
        const { repos, params, body: profile } = req;
        validateUpdateProfile(profile);
        const organization = await repos.organizations.findOneByDid(
          params.did,
          {
            _id: 1,
            didDoc: 1,
            profile: 1,
            activatedServiceIds: 1,
            verifiableCredentialJwt: 1,
            adminEmail: 1,
            normalizedProfileName: 1,
            ids: 1,
            createdAt: 1,
            updatedAt: 1,
          }
        );

        if (organization == null) {
          throw newError.NotFound(
            OrganizationErrorMessages.ORGANIZATION_NOT_FOUND
          );
        }

        await validateProfileName(profile.name, organization, req);

        const modifiedProfile = {
          ...omit(['createdAt'], profile),
          permittedVelocityServiceCategory:
            organization.profile.permittedVelocityServiceCategory,
        };

        const { jwtVc, credentialId, vcUrl } = await prepareProfileVc(
          organization.didDoc,
          { ...organization.profile, ...modifiedProfile }
        );

        const prefixedModification = mapKeys(
          (k) => `profile.${k}`,
          modifiedProfile
        );

        const updatedOrganization = await repos.organizations.update(
          organization._id,
          {
            ...prefixedModification,
            normalizedProfileName: normalizeProfileName(profile.name),
            signedProfileVcJwt: { signedCredential: jwtVc, credentialId },
            verifiableCredentialJwt: vcUrl,
          }
        );
        if (organization.profile.logo !== profile.logo) {
          await repos.images.activate(profile.logo);
          await repos.images.deactivate(organization.profile.logo);
        }
        return buildProfileResponse(updatedOrganization, true);
      }
    )
    .post(
      '/monitoring/sync',
      {
        onRequest: fastify.verifyAccessToken([
          RegistrarScopes.AdminOrganizations,
        ]),
        schema: fastify.autoSchema({
          security: [
            {
              RegistrarOAuth2: [RegistrarScopes.AdminOrganizations],
            },
          ],
          body: { type: 'object' },
          response: {
            204: { type: 'null' },
          },
        }),
      },
      async (req, reply) => {
        reply.code(204);
        return synchronizeMonitors(req);
      }
    );
};

const organizationWithAlternativeDidDoc = (org, context) => {
  const did = selectDid(context.query?.filter?.did, org.didDoc);
  return {
    ...org,
    didDoc: buildDidDocWithAlternativeId(did, org.didDoc),
  };
};

const selectDid = (didFromQuery, didDoc) => {
  const didsFromQuery = castArray(didFromQuery);
  const didsFromDidDoc = getDidAndAliases(didDoc);
  const matchingDids = intersection(didsFromQuery, didsFromDidDoc);
  const matchingDidWeb = find(isWebDid, matchingDids);
  if (matchingDidWeb != null) {
    return matchingDidWeb;
  }
  const aliases = without([didDoc.id], didsFromDidDoc);
  const firstAlias = first(aliases);
  return firstAlias ?? didDoc.id;
};

const loadAllOrgCaoServiceRefs = async (organizationDocs, context) => {
  const allOrgsServices = flatMap('services', organizationDocs);
  return loadCaoServiceRefs(allOrgsServices, context);
};

module.exports = organizationController;
