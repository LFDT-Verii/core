const {
  VNF_GROUP_ID_CLAIM,
  initAuth0Provisioner,
  hasAdminOrganizationScope,
} = require('../../oauth');

const initProvisionGroup = (fastify) => {
  const auth0Provisioner = initAuth0Provisioner(fastify.config);

  return async (organization, context) => {
    const { sendError } = fastify;
    const { repos, user, log } = context;
    const { didDoc, profile } = organization;

    try {
      if (
        isUserGroupIdClaimSet(user) ||
        (await isUserHasGroup(user, context))
      ) {
        await repos.groups.addDidToGroupOfUser(
          user.sub,
          organization.didDoc.id
        );
      } else if (hasAdminOrganizationScope(user)) {
        await repos.groups.createGroup(organization.didDoc.id);
      } else {
        await Promise.all([
          repos.groups.createGroup(organization.didDoc.id, user.sub),
          auth0Provisioner.setAuth0UserGroupId(organization.didDoc.id, context),
        ]);
      }
    } catch (error) {
      const message = 'Error Provisioning Auth0 Apps';
      log.error({ err: error, didDoc, profile }, message);
      sendError(error, { message, didDoc, profile });
    }
  };
};

const isUserGroupIdClaimSet = (user) => user[VNF_GROUP_ID_CLAIM] != null;

const isUserHasGroup = async (user, context) => {
  const { repos } = context;
  const groupByProfile = await repos.groups.findGroupByUserId(user.sub);
  return !!groupByProfile;
};

module.exports = { initProvisionGroup };
