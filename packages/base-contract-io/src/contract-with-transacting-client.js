const { Wallet } = require('ethers');
const {
  generateAccount,
  signArguments,
} = require('@verii/blockchain-functions');
const { initContractClient } = require('./contract');
const { toEthersPrivateKey } = require('./private-key');

const initContractWithTransactingClient = async (
  { privateKey, contractAddress, rpcProvider, contractAbi },
  context,
) => {
  const transactingWallet = generateAccount();
  const operatorWallet = new Wallet(
    toEthersPrivateKey(privateKey),
    rpcProvider,
  );
  return {
    transactingClient: await initContractClient(
      {
        privateKey: transactingWallet.privateKey,
        contractAddress,
        rpcProvider,
        contractAbi,
        cacheSigner: false,
      },
      context,
    ),
    signature: signArguments(operatorWallet, {
      address: transactingWallet.address,
    }),
  };
};

module.exports = {
  initContractWithTransactingClient,
};
