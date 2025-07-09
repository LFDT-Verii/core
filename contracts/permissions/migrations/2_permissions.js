const fs = require('fs');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');

const PermissionsContract = artifacts.require('Permissions');

const env = process.argv[4] || 'localdocker';
console.log('ENV:', env);

module.exports = async (deployer) => {
  const instance = await deployProxy(PermissionsContract, { deployer });
  const { address } = instance;
  console.log(`Deployed Permissions Proxy to: ${address}`);
  fs.writeFileSync(
    `_${env}-permissions-proxy-contract-address.json`,
    JSON.stringify({ address })
  );
};
