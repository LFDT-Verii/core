/*
 * Copyright 2025 Velocity Team
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
 *
 */

const { toEthereumAddress } = require('@verii/blockchain-functions');
const { map } = require('lodash/fp');
const {
  initPermissionsContractByKeyId,
  initPermissionsContract,
} = require('../../../helpers/init-permissions-contract');

const addOperatorKeys = async (
  { primaryAccount, organization, permissioningKeyId, dltKeys },
  context
) => {
  const permissionContract =
    permissioningKeyId != null
      ? await initPermissionsContractByKeyId(permissioningKeyId, context)
      : await initPermissionsContract(organization, context);

  await Promise.all(
    map(
      ({ publicKey: dltPublicKey }) =>
        permissionContract.addOperatorKey({
          primary: primaryAccount,
          operator: toEthereumAddress(dltPublicKey),
        }),
      dltKeys
    )
  );
};

module.exports = { addOperatorKeys };
