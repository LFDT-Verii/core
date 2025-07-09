const { upgradeProxy } = require('@openzeppelin/truffle-upgrades');
const truffleConfig = require('../truffle-config');

const MetadataRegistry = artifacts.require('MetadataRegistry');

const env = process.argv[4] || 'localdocker';
const networkId = truffleConfig.networks[env].network_id;

console.log(`ENV: ${env} Network Id: ${networkId}`);

const contractAddress = require(`../.openzeppelin/unknown-${networkId}.json`)
  .proxies[0].address;

module.exports = async (deployer) => {
  const instance = await upgradeProxy(contractAddress, MetadataRegistry, {
    deployer,
  });
  console.log('Upgraded:', instance.address);
};
