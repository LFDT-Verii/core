const { isString, isEmpty } = require('lodash/fp');
const ethers = require('ethers');
const { hexFromJwk } = require('@verii/jwt');

const toEthereumAddress = (key) => {
  if (isString(key)) {
    return ethers.computeAddress(`0x${key}`);
  }
  const hexKey = isEmpty(key?.d)
    ? hexFromJwk(key, false)
    : hexFromJwk(key, true);
  return ethers.computeAddress(`0x${hexKey}`);
};

const toHexString = (bigInt) => ethers.toBeHex(bigInt);

const toNumber = (bigInt) => ethers.toNumber(bigInt);

module.exports = {
  toEthereumAddress,
  toHexString,
  toNumber,
};
