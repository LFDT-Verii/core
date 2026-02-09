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
const { enqueue } = require('./sequential-promise-queue');

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
    const sendWithExplicitNonce = async () => {
      const nonce = await this.getNonce('pending');
      this.increment();
      try {
        const populatedTransaction = await this.signer.populateTransaction({
          ...(tx || {}),
          nonce,
        });
        return this.signer.sendTransaction({
          ...populatedTransaction,
          nonce,
        });
      } catch (error) {
        this.reset();
        throw error;
      }
    };

    const sendWithRetry = async () => {
      try {
        return await super.sendTransaction({ ...(tx || {}) });
      } catch (error) {
        this.reset();
        if (!isNonceConflictError(error)) {
          throw error;
        }
        return sendWithExplicitNonce();
      }
    };

    const { taskPromise: txPromise, nextQueue } = enqueue(
      this.sendQueue,
      sendWithRetry,
    );
    this.sendQueue = nextQueue;
    return txPromise;
  }
}

module.exports = { ResyncingNonceManager };
