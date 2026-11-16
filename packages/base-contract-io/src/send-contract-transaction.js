/**
 * Copyright 2026 Velocity Team
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

const maxAttempts = 3;

/**
 * Sends a contract call and waits for it to be mined.
 *
 * Gas is free on the network, so a node accepts any transaction that reuses a
 * pending nonce, and drops the pending transaction it replaces. When another
 * transaction from the same account, sent by any server, takes this call's
 * nonce, the call is sent again with a new one. A replaced call never ran, so
 * sending it again doesn't repeat it.
 *
 * Use it for accounts that send more than one transaction. A temporary
 * account from initContractWithTransactingClient sends only one.
 * @param {{contract: ethers.Contract, method: string, args: unknown[]}} call the call
 * @param {{log: object}} context the context
 * @returns {Promise<ethers.ContractTransactionReceipt>} the call's receipt
 */
const sendContractTransaction = async (call, context, attempt = 1) => {
  const { contract, method, args } = call;
  const startBlock = await contract.runner.provider.getBlockNumber();
  const tx = await contract[method](...args);
  try {
    return toContractReceipt(
      contract,
      await tx.replaceableTransaction(startBlock).wait(),
    );
  } catch (error) {
    if (
      !ethers.isError(error, 'TRANSACTION_REPLACED') ||
      attempt >= maxAttempts
    ) {
      throw error;
    }
    // The other transaction made the same call, so it has done the work.
    if (error.reason === 'repriced') {
      return toContractReceipt(contract, error.receipt);
    }
    context.log.warn(
      { method, nonce: tx.nonce, hash: tx.hash, replacedBy: error.hash },
      'Transaction replaced, sending it again',
    );
    return sendContractTransaction(call, context, attempt + 1);
  }
};

// Decodes the receipt's logs with the contract's events, as the receipt from
// a contract transaction's own wait does.
const toContractReceipt = (contract, receipt) =>
  new ethers.ContractTransactionReceipt(
    contract.interface,
    contract.runner.provider,
    receipt,
  );

module.exports = { sendContractTransaction };
