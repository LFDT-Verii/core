const { createHmac, timingSafeEqual } = require('node:crypto');

const hashCapability = (token, pepper) =>
  createHmac('sha256', pepper).update(token).digest('hex');

const verifyCapability = (token, pepper, expectedHash) => {
  const actual = Buffer.from(hashCapability(token, pepper), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

module.exports = { hashCapability, verifyCapability };
