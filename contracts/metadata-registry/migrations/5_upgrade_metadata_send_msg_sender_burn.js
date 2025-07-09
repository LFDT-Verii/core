const {upgradeProxy} = require('@openzeppelin/truffle-upgrades');
const truffleConfig = require('../truffle-config.js');
const MetadataRegistry = artifacts.require('MetadataRegistry');
const Permissions = artifacts.require('../../permissions/contracts/Permissions')

const env = process.argv[4] || 'localdocker';
const networkId = truffleConfig.networks[env].network_id;

console.log(`ENV: ${env} Network Id: ${networkId}`);

const contractAddress = require(`../.openzeppelin/unknown-${networkId}.json`).proxies[0].address
const permissionsContractAddress = require(`../../permissions/.openzeppelin/unknown-${networkId}.json`).proxies[0].address

module.exports = async function (deployer) {
    const instance = await upgradeProxy(contractAddress, MetadataRegistry, {deployer});
    console.log("Upgraded:", instance.address);
    const permissionsInstance = await Permissions.at(permissionsContractAddress)
    await permissionsInstance.addAddressScope(instance.address, "coupon:burn")
    const hasScope = await permissionsInstance.checkAddressScope(instance.address, "coupon:burn")
    console.log(`Metadata Registry Contract at ${instance.address} add "coupon:burn" result: ${hasScope}`)
};
