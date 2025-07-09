const { Wallet } = require('ethers');
const { signAddress } = require('@verii/blockchain-functions');
const { initContractClient } = require('./contract');

const initContractWithTransactingClient = async (
  { privateKey, contractAddress, rpcProvider, contractAbi },
  context
) => {
  const transactingWallet = Wallet.createRandom();
  const operatorWallet = new Wallet(privateKey, rpcProvider);
  const transactingClient = await initContractClient(
    {
      privateKey: transactingWallet.privateKey,
      contractAddress,
      rpcProvider,
      contractAbi,
    },
    context
  );
  const signature = signAddress({
    address: transactingWallet.address,
    signerWallet: operatorWallet,
  });
  return { transactingClient, signature };
};

module.exports = {
  initContractWithTransactingClient,
};
