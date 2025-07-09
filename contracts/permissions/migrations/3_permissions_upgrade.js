const { upgradeProxy } = require('@openzeppelin/truffle-upgrades');
const truffleConfig = require('../truffle-config');

const Permissions = artifacts.require('Permissions');

const env = process.argv[4] || 'localdocker';
const networkId = truffleConfig.networks[env].network_id;

const contractAddress = require(`../.openzeppelin/unknown-${networkId}.json`)
  .proxies[0].address;
module.exports = async (deployer) => {
  const instance = await upgradeProxy(contractAddress, Permissions, {
    deployer,
  });
  console.log('Upgraded:', instance.address);
};
