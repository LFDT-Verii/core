const HDWalletProvider = require('@truffle/hdwallet-provider');

const privateKey = '';
const rpcUrl = '';
const networks = {
  test: {
    host: 'localhost',
    port: 8545,
    network_id: '*',
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
