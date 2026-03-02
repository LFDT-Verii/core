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
const nonceConflictRetries = 3;
const accountNonceRegexes = [
  /sender account nonce\s+(\d+)/i,
  /account nonce(?: is)?\s+(\d+)/i,
];

const isObjectLike = (value) =>
  value != null && (typeof value === 'object' || typeof value === 'function');

const getNestedErrorCandidates = (value) =>
  [value.error, value.info, value.cause].filter(isObjectLike);

const getErrorText = (value) => {
  const shortMessage =
    typeof value.shortMessage === 'string' ? value.shortMessage : '';
  const message = typeof value.message === 'string' ? value.message : '';
  return `${shortMessage}\n${message}`;
};

const parseNonNegativeInteger = (value) => {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
};

const getMaxNumber = (values) =>
  values.reduce((maxValue, value) => {
    if (value == null) {
      return maxValue;
    }

    if (maxValue == null || value > maxValue) {
      return value;
    }

    return maxValue;
  }, null);

const hasNonceConflictMessage = (value) => {
  return nonceConflictErrorRegex.test(getErrorText(value));
};

const getAccountNonceFromMessage = (value) => {
  const text = getErrorText(value);
  return getMaxNumber(
    accountNonceRegexes.map((regex) =>
      parseNonNegativeInteger(regex.exec(text)?.[1]),
    ),
  );
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

const getMinimumNonceFromError = (error, visited = new Set()) => {
  if (!isObjectLike(error) || visited.has(error)) {
    return null;
  }

  visited.add(error);
  return getMaxNumber([
    getAccountNonceFromMessage(error),
    ...getNestedErrorCandidates(error).map((candidate) =>
      getMinimumNonceFromError(candidate, visited),
    ),
  ]);
};

class ResyncingNonceManager extends ethers.NonceManager {
  constructor(signer) {
    super(signer);
    this.sendQueue = Promise.resolve();
  }

  sendTransaction(tx) {
    const getNonceFloor = async (minimumNonceFromError) => {
      const [pendingNonce, latestNonce] = await Promise.all([
        this.signer.getNonce('pending'),
        this.signer.getNonce('latest'),
      ]);

      return Math.max(
        pendingNonce,
        latestNonce,
        minimumNonceFromError == null ? 0 : minimumNonceFromError,
      );
    };

    const sendWithNonce = async (nonce) => {
      const populatedTransaction = await this.signer.populateTransaction({
        ...(tx || {}),
        nonce,
      });

      return this.signer.sendTransaction({
        ...populatedTransaction,
        nonce,
      });
    };

    const nextMinimumNonceFromError = (minimumNonceFromError, error) => {
      const extractedMinimumNonce = getMinimumNonceFromError(error);
      return getMaxNumber([minimumNonceFromError, extractedMinimumNonce]);
    };

    const sendWithRetry = async (attempt = 1, minimumNonceFromError = null) => {
      try {
        const nonce = await getNonceFloor(minimumNonceFromError);
        return await sendWithNonce(nonce);
      } catch (error) {
        this.reset();
        if (!isNonceConflictError(error) || attempt >= nonceConflictRetries) {
          throw error;
        }

        return sendWithRetry(
          attempt + 1,
          nextMinimumNonceFromError(minimumNonceFromError, error),
        );
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
