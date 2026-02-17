const assert = require('node:assert/strict');

const execute = async (txPromise) => {
  const tx = await txPromise;
  return tx.wait();
};

const expectRevert = async (actionOrPromise, expectedMessage) => {
  try {
    if (typeof actionOrPromise === 'function') {
      await actionOrPromise();
    } else {
      await actionOrPromise;
    }
    assert.fail(`Expected revert with: ${expectedMessage}`);
  } catch (error) {
    const message = String(error?.message || error);
    const expectedMessages = Array.isArray(expectedMessage)
      ? expectedMessage
      : [expectedMessage];
    assert.ok(
      expectedMessages.some((value) => message.includes(value)),
      `Expected one of "${expectedMessages.join('" or "')}", got "${message}"`,
    );
  }
};

const findEvent = (receipt, contract, eventName) => {
  for (const log of receipt.logs) {
    if (log && (log.event === eventName || log.name === eventName)) {
      return {
        name: log.event || log.name,
        args: log.args,
      };
    }
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === eventName) {
        return parsed;
      }
    } catch {
      // ignore non-matching logs
    }
  }
  return null;
};

const normalizeEntries = (entries) =>
  entries.map((entry) => [
    entry.version,
    entry.credentialType,
    entry.algType,
    entry.encryptedPublicKey,
    entry.issuerVc,
  ]);

const signerByAddress = async (signers) =>
  new Map(
    await Promise.all(
      signers.map(async (signer) => [
        (await signer.getAddress()).toLowerCase(),
        signer,
      ]),
    ),
  );

const isOverridesObject = (value) =>
  Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      (Object.prototype.hasOwnProperty.call(value, 'from') ||
        Object.prototype.hasOwnProperty.call(value, 'value') ||
        Object.prototype.hasOwnProperty.call(value, 'gasLimit') ||
        Object.prototype.hasOwnProperty.call(value, 'gasPrice') ||
        Object.prototype.hasOwnProperty.call(value, 'nonce') ||
        Object.prototype.hasOwnProperty.call(value, 'maxFeePerGas') ||
        Object.prototype.hasOwnProperty.call(value, 'maxPriorityFeePerGas')),
  );

const parseContractLogs = (receipt, contract) =>
  receipt.logs
    .map((log) => {
      try {
        const parsed = contract.interface.parseLog(log);
        return {
          event: parsed.name,
          args: parsed.args,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);

const wrapContract = async (contract, signersByAddress) => {
  const address = await contract.getAddress();
  return new Proxy(contract, {
    get(target, prop, receiver) {
      if (prop === 'address') {
        return address;
      }

      if (prop === 'getAddress') {
        return async () => address;
      }

      if (typeof prop !== 'string') {
        return Reflect.get(target, prop, receiver);
      }

      const original = target[prop];
      if (typeof original !== 'function') {
        return original;
      }

      let fragment = null;
      try {
        fragment = target.interface.getFunction(prop);
      } catch {
        fragment = null;
      }

      if (!fragment) {
        return original.bind(target);
      }

      const invoke = async (args, forceCall = false) => {
        let callArgs = [...args];
        let signer = null;
        let overrides = null;

        const maybeOverrides = callArgs[callArgs.length - 1];
        if (isOverridesObject(maybeOverrides)) {
          callArgs = callArgs.slice(0, -1);
          const { from, ...rest } = maybeOverrides;
          if (from) {
            signer = signersByAddress.get(String(from).toLowerCase()) || null;
          }
          if (Object.keys(rest).length > 0) {
            overrides = rest;
          }
        }

        const connected = signer ? target.connect(signer) : target;
        const finalArgs = overrides ? [...callArgs, overrides] : callArgs;

        const isRead = ['view', 'pure'].includes(fragment.stateMutability);
        if (forceCall) {
          if (isRead) {
            return connected[prop](...finalArgs);
          }
          return connected[prop].staticCall(...finalArgs);
        }

        if (isRead) {
          return connected[prop](...finalArgs);
        }

        const tx = await connected[prop](...finalArgs);
        const receipt = await tx.wait();
        return {
          ...receipt,
          logs: parseContractLogs(receipt, target),
        };
      };

      const wrappedMethod = (...args) => invoke(args, false);
      wrappedMethod.call = (...args) => invoke(args, true);
      return wrappedMethod;
    },
  });
};

module.exports = {
  execute,
  expectRevert,
  findEvent,
  normalizeEntries,
  signerByAddress,
  isOverridesObject,
  parseContractLogs,
  wrapContract,
};
