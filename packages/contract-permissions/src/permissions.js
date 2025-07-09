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

const { initContractClient } = require('@verii/base-contract-io');

const contractAbi = require('./contracts/permissions.json');

const initPermissions = async (
  { privateKey, contractAddress, rpcProvider },
  context
) => {
  const { log } = context;
  log.info({ func: 'initPermission', privateKey, contractAddress });

  const { contractClient } = await initContractClient(
    {
      privateKey,
      contractAddress,
      rpcProvider,
      contractAbi,
    },
    context
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
    const tx = await contractClient.updateAddressScopes(
      address,
      scopesToAdd,
      scopesToRemove
    );
    await tx.wait();
  };

  const addAddressScope = async ({ address, scope }) => {
    log.info({ func: 'addAddressScope', address, scope });
    const tx = await contractClient.addAddressScope(address, scope);
    await tx.wait();
  };

  const removeAddressScope = async ({ address, scope }) => {
    log.info({ func: 'removeAddressScope', address, scope });
    const tx = await contractClient.removeAddressScope(address, scope);
    await tx.wait();
  };

  const getPrimaries = async () => {
    log.info({ func: 'getPrimaries' });
    return contractClient.getPrimaries();
  };

  const addPrimary = async ({ primary, permissioning, rotation }) => {
    log.info({ func: 'addPrimary', primary, permissioning, rotation });
    const tx = await contractClient.addPrimary(
      primary,
      permissioning,
      rotation
    );
    await tx.wait();
  };

  const removeOperatorKey = async ({ primary, operator }) => {
    log.info({ func: 'removeOperator', primary, operator });
    const tx = await contractClient.removeOperatorKey(primary, operator);
    await tx.wait();
  };

  const addOperatorKey = async ({ primary, operator }) => {
    log.info({ func: 'addOperatorKey', primary, operator });
    const tx = await contractClient.addOperatorKey(primary, operator);
    await tx.wait();
  };

  const rotateOperatorKey = async ({ primary, newOperator, oldOperator }) => {
    log.info({ func: 'rotateOperatorKey', primary, newOperator, oldOperator });
    const tx = await contractClient.rotateOperatorKey(
      primary,
      newOperator,
      oldOperator
    );
    await tx.wait();
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
    const tx = await contractClient.rotatePermissioning(
      primary,
      newPermissioning,
      newRotation
    );
    await tx.wait();
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
