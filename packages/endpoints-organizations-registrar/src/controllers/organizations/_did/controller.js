const {
  all,
  concat,
  difference,
  filter,
  first,
  flow,
  isEmpty,
  map,
  partition,
  pullAll,
  some,
  uniq,
  forEach,
} = require('lodash/fp');
const newError = require('http-errors');
const {
  buildDidDocWithAlternativeId,
  toRelativeServiceId,
} = require('@verii/did-doc');
const { resolveDidWeb } = require('@verii/did-web');
const {
  VerifiableCredentialTypes,
  VerifiableCredentialFormats,
} = require('@verii/verifiable-credentials');
const { decodeCredentialJwt, jwkFromSecp256k1Key } = require('@verii/jwt');
const { publish } = require('@spencejs/spence-events');
const {
  verifyUserOrganizationReadAuthorized,
} = require('../../../plugins/authorization');
const {
  initBuildOrganizationModificationsOnServiceChange,
  runAllOrgChecks,
  OrganizationErrorMessages,
  OrganizationServiceErrorMessages,
  RegistrarScopes,
  initProvisionAuth0ClientGrants,
  loadCaoServiceRefs,
  updateBlockchainPermissionsFromPermittedServices,
  buildPublicProfile,
  validateServicesForDelete,
  initAuth0Provisioner,
  validateByoDidDocService,
} = require('../../../entities');

const organizationController = async (fastify) => {
  const { sendError } = fastify;

  const auth0Provisioner = initAuth0Provisioner(fastify.config);
  const provisionAuth0ClientGrants =
    initProvisionAuth0ClientGrants(auth0Provisioner);

  const buildOrganizationModificationsOnServiceChange =
    initBuildOrganizationModificationsOnServiceChange(fastify);

  fastify
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
          response: {
            200: {
              $ref: 'did-doc#',
            },
          },
        }),
      },
      async ({ repos, params }) => {
        const organization = await repos.organizations.findOne({
          filter: {
            'didDoc.id': params.did,
            didNotCustodied: false,
          },
        });
        if (organization == null) {
          throw newError.NotFound(
            OrganizationErrorMessages.ORGANIZATION_NOT_FOUND
          );
        }
        return organization.didDoc;
      }
    )
    .get(
      '/resolve-vc',
      {
        schema: fastify.autoSchema({
          query: {
            type: 'object',
            properties: {
              type: {
                description: 'The type of verifiable credential to retrieve',
                type: 'string',
              },
            },
            required: ['type'],
          },
          response: {
            200: {
              type: 'array',
              items: { $ref: 'organization-profile-verifiable-credential#' },
            },
            ...fastify.NotFoundResponse,
          },
        }),
      },
      async ({ repos, params, query }) => {
        const orgDoc = await repos.organizations.findOneByDid(params.did, {
          signedProfileVcJwt: 1,
          id: -1,
        });

        if (isEmpty(orgDoc)) {
          throw newError.NotFound(
            OrganizationErrorMessages.ORGANIZATION_NOT_FOUND
          );
        }
        if (query.type !== VerifiableCredentialTypes.BASIC_PROFILE_V1_0) {
          throw newError.BadRequest(
            OrganizationErrorMessages.UNRECOGNIZED_VERIFIABLE_CREDENTIAL_TYPE
          );
        }
        if (orgDoc?.signedProfileVcJwt?.signedCredential == null) {
          return [];
        }
        return [
          {
            format: VerifiableCredentialFormats.JWT_VC,
            vc: orgDoc.signedProfileVcJwt.signedCredential,
          },
        ];
      }
    )
    .get(
      '/resolve-vc/:id',
      {
        schema: fastify.autoSchema({
          params: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
              },
            },
          },
          response: {
            200: { $ref: 'organization-profile-verifiable-credential#' },
          },
        }),
      },
      async ({ repos, params }) => {
        const orgDoc = await repos.organizations.findOneByDid(params.did, {
          signedProfileVcJwt: 1,
          id: -1,
        });

        if (isEmpty(orgDoc)) {
          throw newError.NotFound(
            OrganizationErrorMessages.ORGANIZATION_NOT_FOUND
          );
        }

        const { credentialId, signedCredential } = orgDoc.signedProfileVcJwt;

        if (credentialId !== params.id) {
          throw newError.NotFound(
            OrganizationErrorMessages.VERIFIABLE_CREDENTIAL_NOT_FOUND
          );
        }
        return {
          format: VerifiableCredentialFormats.JWT_VC,
          vc: signedCredential,
        };
      }
    )
    .get(
      '/verified-profile',
      {
        schema: fastify.autoSchema({
          response: {
            200: { $ref: 'organization-verified-profile#' },
          },
        }),
      },
      async (req) => {
        const { repos, params, config } = req;
        const org = await repos.organizations.findOneByDid(params.did, {
          didDoc: 1,
          signedProfileVcJwt: 1,
          _id: -1,
        });

        const {
          signedProfileVcJwt: { signedCredential },
        } = org;
        const credentialChecks = await runAllOrgChecks(
          {
            signedCredential,
            rootDid: config.rootDid,
            rootJwk: jwkFromSecp256k1Key(config.rootPrivateKey, false),
          },
          req
        );

        const decodedCredential = await decodeCredentialJwt(signedCredential);
        const didDoc = buildDidDocWithAlternativeId(params.did, org.didDoc);
        const profile = {
          ...decodedCredential.credentialSubject,
          id: didDoc.id,
          alsoKnownAs: didDoc.alsoKnownAs,
        };
        return {
          ...decodedCredential,
          credentialChecks,
          credentialSubject: buildPublicProfile(profile),
        };
      }
    )
    .post(
      '/deactivate-services',
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
          body: {
            type: 'object',
            properties: {
              serviceIds: {
                type: 'array',
                minItems: 1,
                items: { type: 'string' },
              },
            },
            required: ['serviceIds'],
          },
          response: {
            200: {
              type: 'object',
              properties: {
                profile: {
                  $ref: 'organization-profile#',
                },
                activatedServiceIds: {
                  type: 'array',
                  items: { type: 'string' },
                },
                updatedAt: {
                  type: 'string',
                  format: 'date-time',
                },
                createdAt: {
                  type: 'string',
                  format: 'date-time',
                },
              },
            },
          },
        }),
      },
      async (req) => {
        const {
          repos,
          params,
          body: { serviceIds: bodyServicesIds },
          log,
        } = req;
        const servicesIds = flow(
          map(toRelativeServiceId),
          uniq
        )(bodyServicesIds ?? []);

        const organization = await repos.organizations.findOneByDid(
          params.did,
          {
            didDoc: 1,
            authClients: 1,
            activatedServiceIds: 1,
            profile: 1,
            didNotCustodied: 1,
            services: 1,
          }
        );

        if (organization == null) {
          throw newError.NotFound(
            OrganizationErrorMessages.ORGANIZATION_NOT_FOUND
          );
        }

        const didDocument = organization.didNotCustodied
          ? await resolveDidWeb(organization.didDoc.id)
          : organization.didDoc;

        validateServicesForDelete({
          didDoc: didDocument,
          servicesIds,
          activatedServiceIds: organization.activatedServiceIds,
        });

        const activatedServiceIds = pullAll(
          servicesIds,
          organization.activatedServiceIds
        );

        const organizationModifications =
          await buildOrganizationModificationsOnServiceChange({
            organization,
            activatedServiceIds,
          });

        const updatedOrganization = await repos.organizations.update(
          organization._id,
          organizationModifications
        );

        await updateBlockchainPermissionsFromPermittedServices(
          {
            organization: updatedOrganization,
          },
          req
        );

        const removeGrant = async (serviceId) => {
          const org = await repos.organizations.findOneByDid(params.did, {
            didDoc: 1,
            authClients: 1,
            activatedServiceIds: 1,
            profile: 1,
          });
          const [authClientsToDelete, remainingAuthClients] = partition(
            { serviceId: toRelativeServiceId(serviceId) },
            org.authClients
          );
          const authClientToDelete = first(authClientsToDelete);
          try {
            await auth0Provisioner.removeAuth0Grants(authClientToDelete);
            await repos.organizations.update(org._id, {
              authClients: [
                { ...authClientToDelete, clientGrantIds: [] },
                ...remainingAuthClients,
              ],
            });
          } catch (error) {
            const message = 'Error Provisioning Auth0 Apps';
            const messageContext = { authClientToDelete };
            log.error({ err: error, ...messageContext }, message);
            sendError(error, messageContext);
          }
        };

        for (const serviceId of servicesIds) {
          // eslint-disable-next-line no-await-in-loop
          await removeGrant(serviceId);
        }

        const updatedOrg = await repos.organizations.findOneByDid(params.did, {
          activatedServiceIds: 1,
          profile: 1,
          createdAt: 1,
          updatedAt: 1,
        });
        return {
          profile: {
            id: params.did,
            ...updatedOrg.profile,
          },
          activatedServiceIds: updatedOrg.activatedServiceIds,
          createdAt: updatedOrg.createdAt,
          updatedAt: updatedOrg.updatedAt,
        };
      }
    )
    .post(
      '/activate-services',
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
          body: {
            type: 'object',
            properties: {
              serviceIds: {
                type: 'array',
                items: {
                  type: 'string',
                },
                minItems: 1,
              },
            },
            required: ['serviceIds'],
          },
          response: {
            200: {
              type: 'object',
              properties: {
                profile: { $ref: 'organization-profile#' },
                activatedServiceIds: {
                  type: 'array',
                  items: {
                    type: 'string',
                  },
                },
                updatedAt: {
                  type: 'string',
                  format: 'date-time',
                },
                createdAt: {
                  type: 'string',
                  format: 'date-time',
                },
              },
            },
          },
        }),
      },
      async (req) => {
        const {
          repos,
          params,
          body: { serviceIds },
          log,
        } = req;
        const organization = await repos.organizations.findOneByDid(
          params.did,
          {
            _id: 1,
            didDoc: 1,
            profile: 1,
            activatedServiceIds: 1,
            verifiableCredentialJwt: 1,
            adminEmail: 1,
            ids: 1,
            didNotCustodied: 1,
            authClients: 1,
            services: 1,
            updatedAt: 1,
            createdAt: 1,
          }
        );

        const serviceIdsToActivate = difference(
          serviceIds,
          organization.activatedServiceIds
        );
        if (isEmpty(serviceIdsToActivate)) {
          return {};
        }

        if (
          !all(
            (id) => some({ id }, organization.services),
            serviceIdsToActivate
          )
        ) {
          throw newError.BadRequest(
            OrganizationServiceErrorMessages.ORGANIZATION_SERVICE_NOT_FOUND
          );
        }

        // validate byo did scenarios
        if (organization.didNotCustodied) {
          const didDocument = await resolveDidWeb(organization.didDoc.id);
          const keys = await repos.organizationKeys.find({
            filter: { organizationId: organization._id },
          });

          forEach((serviceId) => {
            validateByoDidDocService(didDocument, serviceId, keys);
          }, serviceIdsToActivate);
        }

        // Update Profile
        const activatedServiceIds = flow(
          concat(organization.activatedServiceIds ?? []),
          uniq
        )(serviceIdsToActivate);

        const authClients = await provisionAuth0ClientGrants(
          organization,
          activatedServiceIds
        );

        const organizationModifications =
          await buildOrganizationModificationsOnServiceChange({
            organization,
            activatedServiceIds,
            authClients,
          });

        const updatedOrganization = await repos.organizations.update(
          organization._id,
          organizationModifications
        );

        await updateBlockchainPermissionsFromPermittedServices(
          {
            organization: updatedOrganization,
          },
          req
        );

        try {
          const caoServiceRefs = await loadCaoServiceRefs(
            filter(
              (service) => activatedServiceIds.includes(service.id),
              organization.services
            ),
            req
          );
          await publish(
            'services',
            'activated',
            {
              organization,
              activatedServiceIds: serviceIdsToActivate,
              caoServiceRefs,
            },
            req
          );
        } catch (error) {
          const message =
            'Unable to send email notifications after activating services';
          log.error({ err: error }, message);
          sendError(error, { message });
        }

        return {
          profile: {
            ...updatedOrganization.profile,
            id: params.did,
            verifiableCredentialJwt:
              updatedOrganization.verifiableCredentialJwt,
          },
          activatedServiceIds: organizationModifications.activatedServiceIds,
          createdAt: updatedOrganization.createdAt,
          updatedAt: updatedOrganization.updatedAt,
        };
      }
    )
    .delete(
      '/',
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
          response: {
            204: { type: 'null' },
            400: { $ref: 'error#' },
          },
        }),
      },
      async (req, reply) => {
        const { repos, params } = req;
        const orgToDelete = await repos.organizations.findOneByDid(params.did);

        if (orgToDelete == null) {
          throw newError.NotFound(
            OrganizationErrorMessages.ORGANIZATION_NOT_FOUND
          );
        }
        if (orgToDelete.activatedServiceIds.length > 0) {
          throw newError(400, 'Cant delete. First remove activated services', {
            errorCode: 'deletion_forbidden',
          });
        }

        const groupsToModify = await repos.groups.find({
          filter: { dids: params.did },
        });
        const groupIds = map('_id', groupsToModify);
        await repos.groups.collection().updateMany(
          { _id: { $in: groupIds } },
          {
            $pull: { dids: orgToDelete.didDoc.id },
            $set: { updatedAt: new Date() },
          }
        );

        const modifiedProfile = { ...orgToDelete, deletedAt: new Date() };
        repos.organizations.update(orgToDelete._id, modifiedProfile);

        return reply.status(204).send();
      }
    );
};

module.exports = organizationController;
