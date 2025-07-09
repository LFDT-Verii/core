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

const ethers = require('ethers');

const deployContract = async (
  contractAbi,
  deployerPrivateKey,
  rpcUrl,
  initializer
) => {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  // eslint-disable-next-line better-mutation/no-mutation
  provider.pollingInterval = 100;
  const wallet = new ethers.Wallet(`0x${deployerPrivateKey}`, provider);
  const factory = new ethers.ContractFactory(
    contractAbi.abi,
    contractAbi.bytecode,
    wallet
  );
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const transaction = initializer
    ? await initializer(contract)
    : await contract.initialize();
  await transaction.wait();
  return contract;
};

module.exports = { deployContract };
