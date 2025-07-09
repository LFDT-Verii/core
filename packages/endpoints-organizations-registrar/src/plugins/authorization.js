const { includes } = require('lodash/fp');
const newError = require('http-errors');
const {
  RegistrarScopes,
  GroupErrorMessages,
  UserErrorMessages,
  VNF_GROUP_ID_CLAIM,
  hasAdminOrganizationScope,
  hasWriteOrganizationScope,
  hasReadOrganizationScope,
  hasAdminUsersScope,
  hasReadUsersScope,
  hasWriteUsersScope,
} = require('../entities');

// eslint-disable-next-line complexity
const verifyUserOrganizationWriteAuthorized = async (ctx) => {
  const { method, params, user } = ctx;
  if (hasAdminOrganizationScope(user)) {
    return true;
  }
  if (!hasWriteOrganizationScope(user)) {
    throw new newError.Forbidden(
      UserErrorMessages.MISSING_REQUIRED_SCOPES_TEMPLATE({
        requiredScopes: [
          RegistrarScopes.WriteOrganizations,
          RegistrarScopes.AdminOrganizations,
        ],
      })
    );
  }

  if (params?.did) {
    const orgGroup = await loadGroupByDid(params.did, ctx);
    validateUserGroupIdClaim(user, orgGroup, params.did);
    await syncGroupClientAdmins(user, orgGroup, ctx);
    decorateScope({ dids: [params.did], groupId: orgGroup.groupId }, ctx);
    return true;
  }

  if (user[VNF_GROUP_ID_CLAIM] != null) {
    const userGroup = await loadGroupByUserClaim(user, ctx);
    await syncGroupClientAdmins(user, userGroup, ctx);
    decorateScope(
      {
        dids: method === 'POST' ? ['new'] : userGroup.dids,
        groupId: userGroup.groupId,
      },
      ctx
    );
    return true;
  }

  decorateScope({ dids: ['new'], groupId: 'new' }, ctx);
  return true;
};

const verifyUserOrganizationReadAuthorized = async (ctx) => {
  const { user, params } = ctx;
  if (hasAdminOrganizationScope(user)) {
    return true;
  }
  if (!hasReadOrganizationScope(user)) {
    throw new newError.Forbidden(
      UserErrorMessages.MISSING_REQUIRED_SCOPES_TEMPLATE({
        requiredScopes: [
          RegistrarScopes.ReadOrganizations,
          RegistrarScopes.AdminOrganizations,
        ],
      })
    );
  }

  if (params?.did) {
    const orgGroup = await loadGroupByDid(params.did, ctx);
    validateUserGroupIdClaim(user, orgGroup, params.did);
    await syncGroupClientAdmins(user, orgGroup, ctx);
    decorateScope({ groupId: orgGroup.groupId, dids: [params.did] }, ctx);
    return true;
  }

  validateUserGroupIdClaim(user);
  const userGroup = await loadGroupByUserClaim(user, ctx);
  await syncGroupClientAdmins(user, userGroup, ctx);
  decorateScope(userGroup, ctx);
  return true;
};

const verifyAuthorizedWriteUsers = async (ctx) => {
  const { user, method, params } = ctx;

  if (hasAdminUsersScope(user)) {
    return true;
  }

  if (isParamIdYourself(user, params)) {
    decorateScope({ userId: user.sub }, ctx);
    return true;
  }

  if (!hasWriteUsersScope(user)) {
    throw new newError.Forbidden(
      UserErrorMessages.MISSING_REQUIRED_SCOPES_TEMPLATE({
        user,
        requiredScopes: [
          RegistrarScopes.WriteUsers,
          RegistrarScopes.AdminUsers,
        ],
      })
    );
  }

  validateUserGroupIdClaim(user);
  const group = await loadGroupByUserClaim(user, ctx);
  validateUserIsGroupClientAdmin(user, group);

  decorateScope(
    {
      ...group,
      userId: isCreateMethod(method, params?.id) ? 'new' : params.id,
    },
    ctx
  );
  return true;
};
const verifyAuthorizedReadUsers = async (ctx) => {
  const { user, params } = ctx;
  if (hasAdminUsersScope(user)) {
    return true;
  }

  if (isParamIdYourself(user, params)) {
    decorateScope({ userId: user.sub }, ctx);
    return true;
  }

  if (!hasReadUsersScope(user)) {
    throw new newError.Forbidden(
      UserErrorMessages.MISSING_REQUIRED_SCOPES_TEMPLATE({
        requiredScopes: [RegistrarScopes.ReadUsers, RegistrarScopes.AdminUsers],
      })
    );
  }

  validateUserGroupIdClaim(user);
  const group = await loadGroupByUserClaim(user, ctx);

  decorateScope({ ...group, userId: params.id }, ctx);
  return true;
};

const validateUserGroupIdClaim = (user, orgGroup, orgDid) => {
  if (!user[VNF_GROUP_ID_CLAIM]) {
    throw new newError.NotFound(
      UserErrorMessages.USER_MUST_HAVE_GROUP_CLAIM({ user })
    );
  }
  if (orgGroup != null && user[VNF_GROUP_ID_CLAIM] !== orgGroup.groupId) {
    throw new newError.NotFound(
      UserErrorMessages.USER_CANNOT_ACCESS_ORGANIZATION_GROUP({
        user,
        group: orgGroup,
        did: orgDid,
      })
    );
  }
};

const validateUserIsGroupClientAdmin = (user, group) => {
  if (!includes(user.sub, group.clientAdminIds)) {
    throw new newError.Forbidden(
      UserErrorMessages.USER_NOT_GROUP_CLIENT_ADMIN({
        user,
        group,
      })
    );
  }
};

const loadGroupByDid = async (did, { repos }) => {
  const group = await repos.groups.findGroupByDid(did);
  if (group == null) {
    throw new newError.NotFound(
      GroupErrorMessages.ORGANIZATION_GROUP_NOT_FOUND({ did })
    );
  }
  return group;
};

const loadGroupByUserClaim = async (user, { repos }) => {
  try {
    return await repos.groups.findGroupByGroupId(user[VNF_GROUP_ID_CLAIM]);
  } catch (ex) {
    if (ex.status === 404) {
      throw new newError.Forbidden(
        UserErrorMessages.USER_INVALID_GROUP_CLAIM({ user })
      );
    }
    throw ex;
  }
};

const syncGroupClientAdmins = async (user, group, { repos, log }) => {
  try {
    if (!includes(user.sub, group.clientAdminIds)) {
      await repos.groups.addUserToGroupClientAdmins(group.groupId, user.sub);
    }
  } catch (e) {
    log.warn(e);
  }
};

const isParamIdYourself = (user, params) =>
  params?.id != null && params.id === user.sub;

const isCreateMethod = (method, paramId) => method === 'POST' && !paramId;

const decorateScope = ({ dids, groupId, userId }, ctx) => {
  // eslint-disable-next-line better-mutation/no-mutation
  ctx.scope = {
    ...ctx.scope,
    dids: dids ?? ctx.scope?.dids,
    groupId: groupId ?? ctx.scope?.groupId,
    userId: userId ?? ctx.scope?.userId,
  };
};

module.exports = {
  verifyUserOrganizationWriteAuthorized,
  verifyUserOrganizationReadAuthorized,
  verifyAuthorizedWriteUsers,
  verifyAuthorizedReadUsers,
};
