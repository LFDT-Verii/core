const path = require('path');
require('@nomicfoundation/hardhat-ethers');
require('@openzeppelin/hardhat-upgrades');

const DEFAULT_LOCALDOCKER_PRIVATE_KEY =
  '0x071d76d6395c725960f2f6343bd26cc56173679b3ae33292d99d7abc289832bf';

const normalizePrivateKey = (privateKey) => {
  if (!privateKey) {
    return null;
  }

  const value = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  return /^0x[0-9a-fA-F]{64}$/.test(value) ? value : null;
};

const toNumber = (value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : undefined;
};

const buildHttpNetwork = ({ rpcUrl, privateKey, chainId }) => {
  if (!rpcUrl) {
    return null;
  }

  const networkConfig = { url: rpcUrl };
  const normalizedPrivateKey = normalizePrivateKey(privateKey);
  if (normalizedPrivateKey) {
    networkConfig.accounts = [normalizedPrivateKey];
  }

  const parsedChainId = toNumber(chainId);
  if (parsedChainId) {
    networkConfig.chainId = parsedChainId;
  }

  return networkConfig;
};

const buildNetworks = () => {
  const networks = {
    hardhat: {
      chainId: toNumber(process.env.HARDHAT_CHAIN_ID) || 31337,
      initialBaseFeePerGas: 0,
    },
  };

  const localdocker = buildHttpNetwork({
    rpcUrl: process.env.HARDHAT_LOCALDOCKER_RPC_URL || 'http://localhost:8545',
    privateKey:
      process.env.HARDHAT_LOCALDOCKER_PRIVATE_KEY ||
      DEFAULT_LOCALDOCKER_PRIVATE_KEY,
    chainId: process.env.HARDHAT_LOCALDOCKER_CHAIN_ID || '2020',
  });

  if (localdocker) {
    networks.localdocker = localdocker;
  }

  ['DEV', 'QA', 'STAGING', 'PROD'].forEach((name) => {
    const network = buildHttpNetwork({
      rpcUrl: process.env[`HARDHAT_${name}_RPC_URL`],
      privateKey: process.env[`HARDHAT_${name}_PRIVATE_KEY`],
      chainId: process.env[`HARDHAT_${name}_CHAIN_ID`],
    });

    if (network) {
      networks[name.toLowerCase()] = network;
    }
  });

  return networks;
};

const createHardhatConfig = (baseDir) => ({
  solidity: {
    version: '0.8.4',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: path.join(baseDir, 'contracts'),
    tests: path.join(baseDir, 'test'),
    cache: path.join(baseDir, 'cache', 'hardhat'),
    artifacts: path.join(baseDir, 'build', 'hardhat-artifacts'),
  },
  mocha: {
    timeout: 60000,
  },
  networks: buildNetworks(),
});

module.exports = {
  createHardhatConfig,
};
