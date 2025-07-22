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

// eslint-disable-next-line import/no-extraneous-dependencies
const { rootPrivateKey } = require('@verii/sample-data');
const { initPermissions } = require('@verii/contract-permissions');
const { generateKeyPair } = require('@verii/crypto');
const {
  toEthereumAddress,
} = require('@verii/blockchain-functions');
const { initProvider } = require('@verii/base-contract-io');

const generatePrimaryAndAddOperatorToPrimary = async (
  operatorAddress,
  context
) => {
  const {
    config: { permissionsContractAddress, rpcUrl },
  } = context;
  const rpcProvider = initProvider(rpcUrl, () => 'TOKEN');

  const permissionRootContract = await initPermissions(
    {
      privateKey: rootPrivateKey,
      contractAddress: permissionsContractAddress,
      rpcProvider,
    },
    { ...context, repos: {} }
  );
  const primaryKeyPair = generateKeyPair();
  const primaryPublicAddress = toEthereumAddress(primaryKeyPair.publicKey);
  await permissionRootContract.addPrimary({
    primary: primaryPublicAddress,
    permissioning: primaryPublicAddress,
    rotation: primaryPublicAddress,
  });
  const permissionContract = await initPermissions(
    {
      privateKey: primaryKeyPair.privateKey,
      contractAddress: permissionsContractAddress,
      rpcProvider,
    },
    { ...context, repos: {} }
  );
  await permissionContract.addOperatorKey({
    primary: primaryPublicAddress,
    operator: operatorAddress,
  });
  return primaryPublicAddress;
};

module.exports = { generatePrimaryAndAddOperatorToPrimary };
