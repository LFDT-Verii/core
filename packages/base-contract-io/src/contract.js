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

const { rangeStep } = require('lodash/fp');
const ethers = require('ethers');

const QueryMaxBlocks = 500;
const signerByProvider = new WeakMap();
const signerWithoutProvider = new Map();
const nonceConflictErrorCodes = new Set([
  'NONCE_EXPIRED',
  'REPLACEMENT_UNDERPRICED',
  'NONCE_TOO_LOW',
]);
const nonceConflictErrorRegex =
  /nonce|already been used|replacement fee too low|transaction underpriced/i;
const isObjectLike = (value) =>
  value != null && (typeof value === 'object' || typeof value === 'function');
const getNestedErrorCandidates = (value) =>
  [value.error, value.info, value.cause].filter(isObjectLike);
const hasNonceConflictMessage = (value) => {
  const shortMessage =
    typeof value.shortMessage === 'string' ? value.shortMessage : '';
  const message = typeof value.message === 'string' ? value.message : '';
  return nonceConflictErrorRegex.test(`${shortMessage} ${message}`);
};

const ensureHexPrefix = (privateKey) => {
  const prefix = privateKey?.startsWith('0x') ? '' : '0x';
  return `${prefix}${privateKey}`;
};

const initProvider = (rpcUrl, authenticate, chainId) => {
  const network = chainId ? ethers.Network.from(chainId) : undefined;
  const options = network ? { staticNetwork: network } : undefined;
  const connection = new ethers.FetchRequest(rpcUrl);

  connection.preflightFunc = async (innerConn) => {
    innerConn.setHeader('Authorization', `Bearer ${await authenticate()}`);

    return innerConn;
  };

  const provider = new ethers.JsonRpcProvider(connection, network, options);

  provider.pollingInterval = 1000;

  return provider;
};

const queryBlockRange = async (contract, event, currBlock, latestBlock) => {
  const endBlock = currBlock + QueryMaxBlocks - 1;

  return contract.queryFilter(
    event,
    currBlock,
    endBlock < latestBlock ? endBlock : latestBlock,
  );
};

const initPullLogEntries =
  (contract) =>
  (event) =>
  async (fromBlock = 0) => {
    const latestBlock = await contract.runner.provider.getBlockNumber();
    const blocksRange = rangeStep(QueryMaxBlocks, fromBlock, latestBlock);

    return {
      async *eventsCursor() {
        for (const currBlock of blocksRange) {
          yield queryBlockRange(contract, event, currBlock, latestBlock);
        }
      },
      latestBlock,
    };
  };

const initContractClient = async (
  { privateKey, contractAddress, rpcProvider, contractAbi, cacheSigner = true },
  context,
) => {
  context.log.info({ privateKey, contractAddress }, 'initContractClient');
  if (!contractAddress) {
    throw new Error('Check the required parameters: contractAddress');
  }

  const wallet = privateKey
    ? initWalletSigner(ensureHexPrefix(privateKey), rpcProvider, cacheSigner)
    : null;

  const contractClient = new ethers.Contract(
    contractAddress,
    contractAbi.abi,
    wallet || rpcProvider,
  );

  const pullEvents = initPullLogEntries(contractClient);

  context.log.info('initContractClient done');

  return { wallet, contractClient, pullEvents };
};

const initWalletSigner = (privateKey, rpcProvider, cacheSigner) => {
  const baseWallet = new ethers.Wallet(privateKey, rpcProvider);

  if (!cacheSigner) {
    return baseWallet;
  }
  const signerCache = getSignerCache(rpcProvider);
  const signerCacheKey =
    baseWallet.signingKey.publicKey?.toLowerCase() ??
    baseWallet.address.toLowerCase();
  if (signerCache.has(signerCacheKey)) {
    return signerCache.get(signerCacheKey);
  }

  const signer = new ResyncingNonceManager(baseWallet);

  signerCache.set(signerCacheKey, signer);

  return signer;
};

const isNonceConflictError = (error, visited = new Set()) => {
  if (!isObjectLike(error) || visited.has(error)) {
    return false;
  }

  visited.add(error);

  if (
    nonceConflictErrorCodes.has(error.code) ||
    hasNonceConflictMessage(error)
  ) {
    return true;
  }

  return getNestedErrorCandidates(error).some((candidate) =>
    isNonceConflictError(candidate, visited),
  );
};

class ResyncingNonceManager extends ethers.NonceManager {
  constructor(signer) {
    super(signer);
    this.sendQueue = Promise.resolve();
  }

  sendTransaction(tx) {
    const sendWithRetry = async () => {
      this.reset();
      try {
        return await super.sendTransaction({ ...(tx || {}) });
      } catch (error) {
        if (!isNonceConflictError(error)) {
          throw error;
        }
        this.reset();
        return super.sendTransaction({ ...(tx || {}) });
      }
    };

    const txPromise = this.sendQueue.then(sendWithRetry, sendWithRetry);
    this.sendQueue = txPromise.then(
      () => undefined,
      () => undefined,
    );
    return txPromise;
  }
}

const getSignerCache = (rpcProvider) => {
  if (
    rpcProvider == null ||
    (typeof rpcProvider !== 'object' && typeof rpcProvider !== 'function')
  ) {
    return signerWithoutProvider;
  }

  if (signerByProvider.has(rpcProvider)) {
    return signerByProvider.get(rpcProvider);
  }

  const signerCache = new Map();
  signerByProvider.set(rpcProvider, signerCache);
  return signerCache;
};

module.exports = {
  initProvider,
  initContractClient,
};
