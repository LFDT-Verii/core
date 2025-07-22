const {
  isEmpty,
  values,
  pullAll,
  flatten,
  map,
  uniq,
  flow,
  compact,
} = require('lodash/fp');
const {
  initPermissions,
  AddressScopePermissions,
} = require('@verii/contract-permissions');
const {
  ServiceCategories,
} = require('@verii/organizations-registry');

const ServiceCategoryToPermissions = {
  [ServiceCategories.CredentialAgentOperator]: [],
  [ServiceCategories.HolderAppProvider]: [],
  [ServiceCategories.NodeOperator]: [],
  [ServiceCategories.IdDocumentIssuer]: [
    AddressScopePermissions.TransactionsWrite,
    AddressScopePermissions.CredentialRevoke,
    AddressScopePermissions.CredentialIdentityIssue,
  ],
  [ServiceCategories.NotaryIdDocumentIssuer]: [
    AddressScopePermissions.TransactionsWrite,
    AddressScopePermissions.CredentialRevoke,
    AddressScopePermissions.CredentialIdentityIssue,
  ],
  [ServiceCategories.ContactIssuer]: [
    AddressScopePermissions.TransactionsWrite,
    AddressScopePermissions.CredentialRevoke,
    AddressScopePermissions.CredentialContactIssue,
  ],
  [ServiceCategories.NotaryContactIssuer]: [
    AddressScopePermissions.TransactionsWrite,
    AddressScopePermissions.CredentialRevoke,
    AddressScopePermissions.CredentialContactIssue,
  ],
  [ServiceCategories.IdentityIssuer]: [],
  [ServiceCategories.Inspector]: [
    AddressScopePermissions.TransactionsWrite,
    AddressScopePermissions.CredentialInspect,
  ],
  [ServiceCategories.Issuer]: [
    AddressScopePermissions.TransactionsWrite,
    AddressScopePermissions.CredentialRevoke,
    AddressScopePermissions.CredentialIssue,
  ],
  [ServiceCategories.NotaryIssuer]: [
    AddressScopePermissions.TransactionsWrite,
    AddressScopePermissions.CredentialRevoke,
    AddressScopePermissions.CredentialIssue,
  ],
};

const mapPermissionsToServiceTypes = (permittedVelocityServiceCategories) => {
  if (isEmpty(permittedVelocityServiceCategories)) {
    return {
      permissionsToAdd: [],
      permissionsToRemove: values(AddressScopePermissions),
    };
  }

  const permissionsOfCategories = flow(
    map((serviceCategory) => {
      return ServiceCategoryToPermissions[serviceCategory];
    }),
    flatten,
    uniq,
    compact
  )(permittedVelocityServiceCategories);
  const permissionsToAdd = permissionsOfCategories;
  const permissionsToRemove = pullAll(
    permissionsOfCategories,
    values(AddressScopePermissions)
  );

  return {
    permissionsToAdd,
    permissionsToRemove,
  };
};

const updateBlockchainPermissionsFromPermittedServices = async (
  { organization },
  ctx
) => {
  const { config, rpcProvider } = ctx;
  const { rootPrivateKey, permissionsContractAddress } = config;
  const {
    profile: { permittedVelocityServiceCategory },
    ids: { ethereumAccount: primary },
  } = organization;

  const permissionContractClient = await initPermissions(
    {
      privateKey: rootPrivateKey,
      contractAddress: permissionsContractAddress,
      rpcProvider,
    },
    ctx
  );

  const { permissionsToAdd, permissionsToRemove } =
    mapPermissionsToServiceTypes(permittedVelocityServiceCategory);

  await permissionContractClient.updateAddressScopes({
    address: primary,
    scopesToAdd: permissionsToAdd,
    scopesToRemove: permissionsToRemove,
  });
};

module.exports = {
  updateBlockchainPermissionsFromPermittedServices,
};
