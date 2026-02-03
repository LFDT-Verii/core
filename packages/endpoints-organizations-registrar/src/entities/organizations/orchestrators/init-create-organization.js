const { createFineractClient } = require('@verii/fineract-client');
const { map, some, filter, includes, isEmpty } = require('lodash/fp');
const {
  KeyPurposes,
  generateKeyPair,
  KeyAlgorithms,
} = require('@verii/crypto');
const { toRelativeKeyId } = require('@verii/did-doc');
const { toEthereumAddress } = require('@verii/blockchain-functions');
const { ObjectId } = require('mongodb');
const { publish } = require('@spencejs/spence-events');
const { acceptInvitation } = require('../../invitations');
const {
  buildOrganizationKey,
  addOperatorKeys,
} = require('../../organization-keys');
const {
  activateServices,
  isNodeOperator,
  initProvisionAuth0Clients,
  updateBlockchainPermissionsFromPermittedServices,
} = require('../../organization-services');
const { initAuth0Provisioner } = require('../../oauth');
const {
  initBuildOrganizationModificationsOnServiceChange,
} = require('../domains');
const {
  buildCustodiedOrganization,
} = require('./build-custodied-organization');
const {
  buildNonCustodiedOrganization,
} = require('./build-non-custodied-organization');
const { initProvisionGroup } = require('./init-provision-group');
const { addPrimaryPermissions } = require('./add-primary-permissions');
const {
  getServiceConsentType,
} = require('../../organization-services/domains/get-service-consent-type');

const initCreateOrganization = async (fastify) => {
  const buildOrganizationModificationsOnServiceChange =
    initBuildOrganizationModificationsOnServiceChange(fastify);

  const provisionGroup = await initProvisionGroup(fastify);
  const auth0Provisioner = await initAuth0Provisioner(fastify.config);
  const provisionAuth0Clients = initProvisionAuth0Clients(auth0Provisioner);

  return async (
    { byoDid, byoKeys, serviceEndpoints, profile, invitationCode },
    context,
  ) => {
    const { repos, kms, user } = context;

    const invitation = await acceptInvitation(invitationCode, context);
    const buildOrganization =
      byoDid == null
        ? buildCustodiedOrganization
        : buildNonCustodiedOrganization;
    const { newOrganization, newKeys, newKeyPairs, caoServiceRefs } =
      await buildOrganization(
        {
          byoDid,
          byoKeys,
          serviceEndpoints,
          profile,
          invitation,
        },
        context,
      );

    const organization = await repos.organizations.insert(newOrganization);
    await provisionGroup(organization, context);

    const activatedServiceIds = activateServices(
      organization,
      organization.services,
      context,
    );

    if (!isEmpty(organization.services)) {
      const consents = map((service) => {
        return {
          userId: user.sub,
          organizationId: organization._id,
          type: getServiceConsentType(service),
          version: 1,
          serviceId: service.id,
        };
      }, organization.services);
      await repos.registrarConsents.registerConsents(consents);
    }
    const authClients = await provisionAuth0Clients(
      organization,
      organization.services,
      activatedServiceIds,
      context,
    );

    const primaryKeyPair = generateKeyPair({ format: 'jwk' });
    const primaryAccount = toEthereumAddress(primaryKeyPair.publicKey);
    const fineractIds = await createFineractClient(
      organization,
      some(isNodeOperator, organization.services),
      context,
    );

    const organizationModifications =
      await buildOrganizationModificationsOnServiceChange({
        organization,
        activatedServiceIds,
        newOrganizationIds: {
          did: organization.didDoc.id,
          mongoId: organization._id,
          ethereumAccount: primaryAccount,
          brokerClientId: new ObjectId(),
          ...fineractIds,
        },
        authClients,
      });
    const finalOrganization = await repos.organizations.update(
      organization._id,
      organizationModifications,
    );

    const permissioningKeyPair = generateKeyPair({ format: 'jwk' });
    const permissioningKeyEntry = await kms.importKey({
      ...permissioningKeyPair,
      algorithm: 'ec',
      curve: 'secp256k1',
    });
    const rotationKeyPair = generateKeyPair({ format: 'jwk' });
    const rotationKeyEntry = await kms.importKey({
      ...rotationKeyPair,
      algorithm: 'ec',
      curve: 'secp256k1',
    });
    await addPrimaryPermissions(
      {
        primaryAccount,
        rotationKeyPair,
        permissioningKeyPair,
        newKeys,
      },
      context,
    );

    const keySpecs = [
      ...newKeys,
      {
        id: toRelativeKeyId(`#vnf-permissioning-${Date.now()}`),
        kmsKeyId: permissioningKeyEntry.id,
        publicKey: permissioningKeyPair.publicKey,
        custodied: true,
        purposes: [KeyPurposes.PERMISSIONING],
        algorithm: KeyAlgorithms.SECP256K1,
      },
      {
        id: toRelativeKeyId(`#vnf-rotation-${Date.now()}`),
        kmsKeyId: rotationKeyEntry.id,
        publicKey: rotationKeyPair.publicKey,
        custodied: true,
        purposes: [KeyPurposes.ROTATION],
        algorithm: KeyAlgorithms.SECP256K1,
      },
    ];

    const keys = map(
      (spec) =>
        buildOrganizationKey(
          finalOrganization._id,
          finalOrganization.didDoc.id,
          spec,
        ),
      keySpecs,
    );

    await repos.organizationKeys.insertMany(keys);

    const dltKeys = filter(
      ({ purposes }) => includes(KeyPurposes.DLT_TRANSACTIONS, purposes),
      keys,
    );
    await addOperatorKeys(
      {
        organization,
        primaryAccount,
        permissioningKeyId: permissioningKeyEntry._id,
        dltKeys,
      },
      context,
    );

    await updateBlockchainPermissionsFromPermittedServices(
      { organization: finalOrganization },
      context,
    );

    await repos.images.activate(finalOrganization.profile.logo);

    await publish(
      'organizations',
      'created',
      {
        organization: finalOrganization,
        invitation,
        addedServices: finalOrganization.services,
        activatedServiceIds,
        caoServiceRefs,
      },
      context,
    );

    return {
      organization: finalOrganization,
      keys,
      keyPairs: [...newKeyPairs, permissioningKeyPair, rotationKeyPair],
      authClients,
    };
  };
};

module.exports = { initCreateOrganization };
