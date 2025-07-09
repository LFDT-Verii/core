const { jwtDecode } = require('@verii/jwt');

const getIssuerInfo = async (
  issuerVc,
  { resolveKid, getOrganizationVerifiedProfile },
  context
) => {
  const { header, payload } = jwtDecode(issuerVc);
  const issuerPublicKey = await resolveKid({ kid: header.kid }, context);
  const organizationVerifiedProfile = await getOrganizationVerifiedProfile(
    payload.iss,
    context
  );

  return {
    issuerPublicKey,
    organizationVerifiedProfile,
  };
};

module.exports = { getIssuerInfo };
