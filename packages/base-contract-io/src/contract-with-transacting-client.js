const { Wallet } = require('ethers');
const { signArguments } = require('@verii/blockchain-functions');
const { initContractClient } = require('./contract');

const initContractWithTransactingClient = async (
  { privateKey, contractAddress, rpcProvider, contractAbi },
  context,
) => {
  const transactingWallet = Wallet.createRandom();
  const operatorWallet = new Wallet(privateKey, rpcProvider);
  return {
    transactingClient: await initContractClient(
      {
        privateKey: transactingWallet.privateKey,
        contractAddress,
        rpcProvider,
        contractAbi,
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
