const HDWalletProvider = require('@truffle/hdwallet-provider');

const privateKey =
  '071d76d6395c725960f2f6343bd26cc56173679b3ae33292d99d7abc289832bf';
const rpcUrl = 'http://localhost:8545';
const networks = {
  localdocker: {
    gasPrice: 0,
    gas: '0x1ffffffffffffe',
    rpcUrl,
    provider: () =>
      new HDWalletProvider({
        providerOrUrl: rpcUrl,
        privateKeys: [privateKey],
      }),
    network_id: '2020',
  },
};
module.exports = {
  networks,
  compilers: {
    solc: {
      version: '0.8.4', // Fetch exact version from solc-bin (default: truffle's version)
      settings: {
        // See the solidity docs for advice about optimization and evmVersion
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    },
  },
  db: {
    enabled: false,
  },
};
