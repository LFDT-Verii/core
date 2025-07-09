const {upgradeProxy} = require('@openzeppelin/truffle-upgrades');
const truffleConfig = require('../truffle-config.js');
const MetadataRegistry = artifacts.require('MetadataRegistry');

const env = process.argv[4] || 'localdocker';
const networkId = truffleConfig.networks[env].network_id;

console.log(`ENV: ${env} Network Id: ${networkId}`);

const contractAddress = require(`../.openzeppelin/unknown-${networkId}.json`).proxies[0].address
const permissionsContractAddress = require(`../../permissions/.openzeppelin/unknown-${networkId}.json`).proxies[0].address

module.exports = async function (deployer) {
    const instance = await upgradeProxy(contractAddress, MetadataRegistry, {deployer});
    console.log("Upgraded:", instance.address);
    await instance.setPermissionsAddress(permissionsContractAddress)
    console.log(`Metadata Registry Contract at ${instance.address} Permission Contract instance set to: ${permissionsContractAddress}`)
};
