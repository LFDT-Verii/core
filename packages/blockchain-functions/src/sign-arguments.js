const { keccak256, AbiCoder } = require('ethers');

const signAddress = ({ address, signerWallet }) =>
  signArguments(signerWallet, { address });

const signArguments = (signerWallet, argumentModel) => {
  const encodedArgs = AbiCoder.defaultAbiCoder().encode(
    Object.keys(argumentModel),
    Object.values(argumentModel)
  );
  const hash = keccak256(encodedArgs);
  return signerWallet.signingKey.sign(hash).serialized;
};

module.exports = {
  signAddress,
  signArguments,
};
