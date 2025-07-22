const {
  getOrganizationVerifiedProfile,
} = require('@verii/common-fetchers');
const { isEmpty } = require('lodash/fp');

const loadOrgInfo = async (did, context) => {
  const {
    config: { appRedirectLogoFallbackUrl, vnfDid },
  } = context;

  try {
    const [org, vnfOrg] = await Promise.all([
      getOrganizationVerifiedProfile(did, context),
      getOrganizationVerifiedProfile(vnfDid, context),
    ]);
    if (!isEmpty(org?.credentialSubject?.logo)) {
      return {
        orgLogoUrl: org?.credentialSubject?.logo,
        orgName: org?.credentialSubject?.name,
      };
    }
    if (!isEmpty(vnfOrg?.credentialSubject?.logo)) {
      return {
        orgLogoUrl: vnfOrg?.credentialSubject?.logo,
        orgName: vnfOrg?.credentialSubject?.name,
      };
    }
    return {
      orgLogoUrl: appRedirectLogoFallbackUrl,
      orgName: 'no name',
    };
  } catch (e) {
    return {
      orgLogoUrl: appRedirectLogoFallbackUrl,
      orgName: 'no name',
    };
  }
};

module.exports = {
  loadOrgInfo,
};
