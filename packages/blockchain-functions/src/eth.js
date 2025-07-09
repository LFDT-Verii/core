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

const initGetBlockNumber = async ({ rpcUrl, authenticate }) => {
  const token = await authenticate();
  const connection = new ethers.FetchRequest(rpcUrl);
  connection.setHeader('Authorization', `Bearer ${token}`);
  const provider = new ethers.JsonRpcProvider(connection);

  return () => provider.getBlockNumber();
};

const initGetBlock = async ({ rpcUrl, authenticate }) => {
  const token = await authenticate();
  const connection = new ethers.FetchRequest(rpcUrl);
  connection.setHeader('Authorization', `Bearer ${token}`);
  const provider = new ethers.JsonRpcProvider(connection);

  return (blockNumber) => provider.getBlock(blockNumber);
};

const sendNoOpTx = async (wallet, nonce) => {
  const tx = { to: wallet.address, value: '0x0', nonce };

  const currNonce = await wallet.getNonce();

  if (nonce >= currNonce) {
    await wallet.sendTransaction(tx);
  }
};

module.exports = {
  initGetBlockNumber,
  initGetBlock,
  sendNoOpTx,
};
