const { initHasMatchingScope } = require('@verii/auth');

const RegistrarScopes = {
  AdminOrganizations: 'admin:organizations',
  WriteOrganizations: 'write:organizations',
  ReadOrganizations: 'read:organizations',
  AdminUsers: 'admin:users',
  WriteUsers: 'write:users',
  ReadUsers: 'read:users',
  EventsTrigger: 'events:trigger',
};

const hasAdminOrganizationScope = initHasMatchingScope([
  RegistrarScopes.AdminOrganizations,
]);
const hasReadOrganizationScope = initHasMatchingScope([
  RegistrarScopes.ReadOrganizations,
]);
const hasWriteOrganizationScope = initHasMatchingScope([
  RegistrarScopes.WriteOrganizations,
]);

const hasWriteUsersScope = initHasMatchingScope([RegistrarScopes.WriteUsers]);
const hasReadUsersScope = initHasMatchingScope([RegistrarScopes.ReadUsers]);
const hasAdminUsersScope = initHasMatchingScope([RegistrarScopes.AdminUsers]);

module.exports = {
  RegistrarScopes,
  hasAdminOrganizationScope,
  hasWriteOrganizationScope,
  hasReadOrganizationScope,
  hasAdminUsersScope,
  hasWriteUsersScope,
  hasReadUsersScope,
};
