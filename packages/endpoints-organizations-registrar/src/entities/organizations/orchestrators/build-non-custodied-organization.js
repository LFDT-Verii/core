const newError = require('http-errors');
const { map, omit } = require('lodash/fp');
const { resolveDidWeb } = require('@verii/did-web');
const {
  buildOrganizationServices,
  loadCaoServiceRefs,
  validateByoDidDocService,
  validateServices,
} = require('../../organization-services');
const {
  extractVerificationMethodFromByoDID,
} = require('../../organization-keys');
const { validateByoDidKeys, normalizeProfileName } = require('../domains');

const buildNonCustodiedOrganization = async (
  { byoDid, byoKeys, serviceEndpoints, profile, invitation },
  context,
) => {
  const { repos } = context;

  // ensure did isn't already locally registered
  const orgDb = await repos.organizations.findOne({
    filter: { 'didDoc.id': byoDid },
  });
  if (orgDb) {
    throw newError(400, 'Organization already exists', {
      errorCode: 'organization_already_exists',
    });
  }
  const didDocument = await resolveDidWeb(byoDid);

  // load keys from remote did document
  validateByoDidKeys(byoKeys);
  const newKeys = await Promise.all(
    map(
      (byoKey) => ({
        ...byoKey,
        verificationMethod: extractVerificationMethodFromByoDID({
          didDocument,
          kidFragment: byoKey.kidFragment,
        }),
      }),
      byoKeys,
    ),
  );

  const preparedServices = map((serviceEndpoint) => {
    const byoDidDocService = validateByoDidDocService(
      didDocument,
      serviceEndpoint.id,
      newKeys,
    );
    return {
      ...omit(['id'], serviceEndpoint),
      ...byoDidDocService,
    };
  }, serviceEndpoints);

  const newServices = buildOrganizationServices(preparedServices, invitation);

  const caoServiceRefs = await loadCaoServiceRefs(preparedServices, context);
  validateServices(newServices, caoServiceRefs, context);

  return {
    newOrganization: {
      didDoc: {
        id: byoDid,
      },
      profile,
      normalizedProfileName: normalizeProfileName(profile.name),
      didNotCustodied: true,
      services: newServices,
      invitationId: invitation?._id,
    },
    newKeys,
    newKeyPairs: map(() => null, newKeys),
    caoServiceRefs,
  };
};

module.exports = {
  buildNonCustodiedOrganization,
};
