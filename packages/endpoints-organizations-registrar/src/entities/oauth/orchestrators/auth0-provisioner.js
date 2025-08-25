const { kebabCase, trim, map, join, includes } = require('lodash/fp');
const { nanoid } = require('nanoid');
const {
  ServiceCategories,
  ServiceTypesOfServiceCategory,
} = require('@verii/organizations-registry');
const { AuthClientTypes, RoleNames } = require('../domain');

const initRoleNameToRoleId = ({
  auth0SuperuserRoleId,
  auth0ClientAdminRoleId,
  auth0ClientFinanceAdminRoleId,
  auth0ClientSystemUserRoleId,
}) => {
  return (roleName) => {
    switch (roleName) {
      case RoleNames.Superuser:
        return auth0SuperuserRoleId;
      case RoleNames.TokenWalletClientFinanceAdmin:
        return auth0ClientFinanceAdminRoleId;
      case RoleNames.TokenWalletClientSystemUser:
        return auth0ClientSystemUserRoleId;
      case RoleNames.RegistrarClientAdmin:
      default:
        return auth0ClientAdminRoleId;
    }
  };
};
const initAuth0Provisioner = async ({
  auth0Domain,
  auth0ManagementApiAudience,
  auth0ClientId,
  auth0ClientSecret,
  auth0Connection,
  registrarAppUiUrl,
  blockchainApiAudience,
  auth0SuperuserRoleId,
  auth0ClientAdminRoleId,
  auth0ClientFinanceAdminRoleId,
  auth0ClientSystemUserRoleId,
}) => {
  // Use of async import for patching around https://github.com/nodejs/node/issues/58231
  // Remove if migrating to esm
  const { ManagementClient } = await import('auth0');

  const auth0ManagementClient = new ManagementClient({
    domain: auth0Domain,
    audience: auth0ManagementApiAudience,
    clientId: auth0ClientId,
    clientSecret: auth0ClientSecret,
  });

  const roleNameToRoleId = initRoleNameToRoleId({
    auth0SuperuserRoleId,
    auth0ClientAdminRoleId,
    auth0ClientFinanceAdminRoleId,
    auth0ClientSystemUserRoleId,
  });

  const setAuth0UserGroupId = async (did, { user }) => {
    await auth0ManagementClient.users.update(
      { id: user.sub },
      {
        app_metadata: { groupId: did },
      }
    );
  };

  const provisionAuth0SystemClient = async (
    did,
    profile,
    service,
    provisionClientGrant
  ) => {
    const clientDetails = buildClientDetails(did, profile, service);
    if (clientDetails == null) {
      return clientDetails;
    }

    const { name, description, clientType } = clientDetails;

    const { data: auth0Client } = await auth0ManagementClient.clients.create({
      name,
      description,
      logo_uri: trim(profile.logo),
      app_type: 'non_interactive',
      custom_login_page_on: false,
      is_first_party: true,
      is_token_endpoint_ip_header_trusted: true,
      token_endpoint_auth_method: 'client_secret_post',
      oidc_conformant: true,
      grant_types: ['client_credentials'],
      jwt_configuration: {
        lifetime_in_seconds: 36000,
        secret_encoded: true,
        alg: 'RS256',
      },
      client_metadata: {
        did,
        service_id: service.id,
      },
    });

    const response = {
      type: 'auth0',
      clientType,
      serviceId: service.id,
      clientId: auth0Client.client_id,
      clientSecret: auth0Client.client_secret,
    };

    if (provisionClientGrant) {
      const clientGrant = await provisionAuth0SystemClientGrants(
        auth0Client.client_id,
        service.type
      );
      response.clientGrantIds = [clientGrant.id];
    }

    return response;
  };
  const provisionAuth0SystemClientGrants = async (clientId, serviceType) => {
    const clientGrantDetails = buildClientGrantDetails(serviceType);
    if (clientGrantDetails == null) {
      return clientGrantDetails;
    }

    const { audience, scope } = clientGrantDetails;
    const { data: clientGrant } =
      await auth0ManagementClient.clientGrants.create({
        client_id: clientId,
        audience,
        scope,
      });
    return clientGrant;
  };

  const removeAuth0Client = async (authClient) => {
    for (const clientGrantId of authClient.clientGrantIds ?? []) {
      // eslint-disable-next-line no-await-in-loop
      await auth0ManagementClient.clientGrants.delete({ id: clientGrantId });
    }

    await auth0ManagementClient.clients.delete({
      client_id: authClient.clientId,
    });
  };

  const removeAuth0Grants = async (authClient) => {
    for (const clientGrantId of authClient.clientGrantIds ?? []) {
      // eslint-disable-next-line no-await-in-loop
      await auth0ManagementClient.clientGrants.delete({ id: clientGrantId });
    }
  };

  const createAuth0User = async ({ user }) => {
    const { data: createUserResult } = await auth0ManagementClient.users.create(
      {
        email: user.email,
        given_name: user.givenName,
        family_name: user.familyName,
        password: nanoid(28),
        verify_email: false,
        email_verified: false,
        connection: auth0Connection,
        app_metadata: {
          groupId: user.groupId,
        },
      }
    );
    return {
      ...user,
      id: createUserResult.user_id,
    };
  };

  const getUsersByIds = async ({ userIds, fields = ['email'] }) => {
    const query = join(
      ' OR ',
      map((userId) => `user_id:${userId}`, userIds)
    );
    const { data: users } = await auth0ManagementClient.getUsers({
      search_engine: 'v3',
      q: query,
      fields: fields.join(','),
      per_page: 25,
      page: 0,
    });
    return users;
  };

  const addRoleToAuth0User = async ({ user, roleName }) => {
    const { data: roles } = await auth0ManagementClient.users.assignRoles(
      {
        id: user.id,
      },
      {
        roles: [roleNameToRoleId(roleName)],
      }
    );
    return roles;
  };

  const createPasswordChangeTicket = async ({
    user,
    resultUrl = registrarAppUiUrl,
  }) => {
    const { data: ticket } = await auth0ManagementClient.tickets.changePassword(
      {
        user_id: user.id,
        result_url: resultUrl,
        mark_email_as_verified: true,
        ttl_sec: 604800,
      }
    );
    return ticket;
  };

  // See https://velocitycareerlabs.visualstudio.com/velocity/_wiki/wikis/velocity.wiki/171/Authentication?anchor=org-signup-instructions&_a=edit
  const buildClientDetails = (did, profile, service) => {
    if (
      ServiceTypesOfServiceCategory[
        ServiceCategories.CredentialAgentOperator
      ].includes(service?.type)
    ) {
      return {
        name: `${namePrefix(profile)}-${
          AuthClientTypes.CAO_NODE_CLIENT
        }-${did}${service.id}`,
        description: `Credential Agent for "${profile.name}" permitted to issue and verify credentials`,
        clientType: AuthClientTypes.CAO_NODE_CLIENT,
      };
    }

    if (
      ServiceTypesOfServiceCategory[ServiceCategories.NodeOperator].includes(
        service?.type
      )
    ) {
      return {
        name: `${namePrefix(profile)}-${AuthClientTypes.NODE_OPERATOR}-${did}${
          service.id
        }`,
        description: `Administrator for the Node operated by "${profile.name}"`,
        clientType: AuthClientTypes.NODE_OPERATOR,
      };
    }

    return undefined;
  };

  const buildClientGrantDetails = (serviceType) => {
    if (
      includes(
        serviceType,
        ServiceTypesOfServiceCategory[ServiceCategories.CredentialAgentOperator]
      )
    ) {
      return {
        scope: ['eth:*'],
        audience: blockchainApiAudience,
      };
    }

    if (
      ServiceTypesOfServiceCategory[ServiceCategories.NodeOperator].includes(
        serviceType
      )
    ) {
      return {
        scope: ['*:*'],
        audience: blockchainApiAudience,
      };
    }

    return undefined;
  };

  return {
    provisionAuth0SystemClient,
    provisionAuth0SystemClientGrants,
    setAuth0UserGroupId,
    removeAuth0Client,
    createAuth0User,
    addRoleToAuth0User,
    createPasswordChangeTicket,
    getUsersByIds,
    removeAuth0Grants,
  };
};

const namePrefix = (profile) => kebabCase(profile.name);

module.exports = {
  initAuth0Provisioner,
};
