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

module.exports = {
  execute,
  expectRevert,
  findEvent,
};
