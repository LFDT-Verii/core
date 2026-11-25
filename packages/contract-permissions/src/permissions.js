/**
 * Copyright 2023 Velocity Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const {
  initContractClient,
  sendContractTransaction,
} = require('@verii/base-contract-io');

const contractAbi = require('./contracts/permissions.json');

const initPermissions = async (
  { privateKey, contractAddress, rpcProvider },
  context,
) => {
  const { log } = context;
  log.info({
    func: 'initPermission',
    contractAddress,
    hasPrivateKey: Boolean(privateKey),
  });

  const { contractClient } = await initContractClient(
    {
      privateKey,
      contractAddress,
      rpcProvider,
      contractAbi,
    },
    context,
  );

  // The keys that sign here, such as the root key or an organization's
  // permissioning key, may also be sending from other servers.
  const send = (method, ...args) =>
    sendContractTransaction(
      { contract: contractClient, method, args },
      context,
    );

  const updateAddressScopes = async ({
    address,
    scopesToAdd = [],
    scopesToRemove = [],
  }) => {
    log.info({
      func: 'updateAddressScopes',
      address,
      scopesToAdd,
      scopesToRemove,
    });
    await send('updateAddressScopes', address, scopesToAdd, scopesToRemove);
  };

  const addAddressScope = async ({ address, scope }) => {
    log.info({ func: 'addAddressScope', address, scope });
    await send('addAddressScope', address, scope);
  };

  const removeAddressScope = async ({ address, scope }) => {
    log.info({ func: 'removeAddressScope', address, scope });
    await send('removeAddressScope', address, scope);
  };

  const getPrimaries = async () => {
    log.info({ func: 'getPrimaries' });
    return contractClient.getPrimaries();
  };

  const addPrimary = async ({ primary, permissioning, rotation }) => {
    log.info({ func: 'addPrimary', primary, permissioning, rotation });
    await send('addPrimary', primary, permissioning, rotation);
  };

  const removeOperatorKey = async ({ primary, operator }) => {
    log.info({ func: 'removeOperator', primary, operator });
    await send('removeOperatorKey', primary, operator);
  };

  const addOperatorKey = async ({ primary, operator }) => {
    log.info({ func: 'addOperatorKey', primary, operator });
    await send('addOperatorKey', primary, operator);
  };

  const rotateOperatorKey = async ({ primary, newOperator, oldOperator }) => {
    log.info({ func: 'rotateOperatorKey', primary, newOperator, oldOperator });
    await send('rotateOperatorKey', primary, newOperator, oldOperator);
  };

  const rotatePermissioning = async ({
    primary,
    newPermissioning,
    newRotation,
  }) => {
    log.info({
      func: 'rotatePermissioning',
      primary,
      newPermissioning,
      newRotation,
    });
    await send('rotatePermissioning', primary, newPermissioning, newRotation);
  };

  const lookupPrimary = async (address) => {
    log.info({
      func: 'lookupPrimary',
      address,
    });
    return contractClient.lookupPrimary(address);
  };

  return {
    contractClient,
    getPrimaries,
    addAddressScope,
    addOperatorKey,
    addPrimary,
    removeOperatorKey,
    removeAddressScope,
    rotateOperatorKey,
    rotatePermissioning,
    lookupPrimary,
    updateAddressScopes,
  };
};

module.exports = initPermissions;
