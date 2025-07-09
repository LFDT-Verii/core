const { keccak256, AbiCoder } = require('ethers');

const signAddress = ({ address, signerWallet }) => {
  const encodedArgs = AbiCoder.defaultAbiCoder().encode(['address'], [address]);
  const hash = keccak256(encodedArgs);
  const signature = signerWallet.signingKey.sign(hash).serialized;
  return signature;
};

module.exports = {
  signAddress,
};
