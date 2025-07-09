const VNF_GROUP_ID_CLAIM = 'http://velocitynetwork.foundation/groupId';

const AuthClientTypes = {
  CAO_NODE_CLIENT: 'agent',
  REGISTRAR: 'registrar',
  NODE_OPERATOR: 'node',
};

const RoleNames = {
  Superuser: 'superuser',
  RegistrarClientAdmin: 'clientadmin',
  TokenWalletClientFinanceAdmin: 'clientfinanceadmin',
  TokenWalletClientSystemUser: 'clientsystemuser',
  FineractOperationsUser: 'operations',
  FineractBrokerUser: 'broker',
  FineractRegistrarUser: 'registrar',
};

module.exports = {
  VNF_GROUP_ID_CLAIM,
  AuthClientTypes,
  RoleNames,
};
