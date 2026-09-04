const { mapWithIndex } = require('@verii/common-functions');
const { mapKeyResponse } = require('../../organization-keys');

const buildProfileResponse = (organization, includeTimestamps = false) => {
  const profile = {
    ...organization.profile,
    description: organization.profile.description || '',
    id: organization.didDoc.id,
    // Registrations interrupted before soft deletion of failed provisioning was
    // introduced may still lack the derived profile fields
    permittedVelocityServiceCategory:
      organization.profile.permittedVelocityServiceCategory ?? [],
    verifiableCredentialJwt: organization.verifiableCredentialJwt,
  };
  if (includeTimestamps) {
    profile.updatedAt = organization.updatedAt;
    profile.createdAt = organization.createdAt;
  }

  return profile;
};
const buildFullOrganizationResponse = ({
  organization,
  services,
  profile,
  keys,
  keyPairs,
  ...rest
}) => ({
  id: organization.didDoc.id,
  didDoc: organization.didDoc,
  ids: organization.ids,
  activatedServiceIds: organization.activatedServiceIds,
  custodied: !organization.didNotCustodied,
  profile: profile ?? buildProfileResponse(organization),
  services: services ?? organization.services,
  keys: keys != null ? buildOutgoingKeys(keys, keyPairs) : organization.keys,
  ...rest,
});

const buildOutgoingKeys = (keys, keyPairs) =>
  mapWithIndex((key, i) => mapKeyResponse(key, keyPairs[i]), keys);

module.exports = { buildFullOrganizationResponse, buildProfileResponse };
