
const { upgradeProxy } = require('@openzeppelin/truffle-upgrades');
const truffleConfig = require('../truffle-config.js');
const MetadataRegistry = artifacts.require('MetadataRegistry');

const env = process.argv[4] || 'localdocker';
const networkId = truffleConfig.networks[env].network_id;

console.log(`ENV: ${env} Network Id: ${networkId}`);


const couponContractAddressV2 = require(`../../verification-coupon/.openzeppelin/unknown-${networkId}.json`).proxies[1].address;
const contractAddress = require(`../.openzeppelin/unknown-${networkId}.json`).proxies[0].address 
console.log('contractAddress', contractAddress, 'couponContractAddressV2', couponContractAddressV2)

module.exports = async function (deployer) {
    const instance = await upgradeProxy(contractAddress, MetadataRegistry, { deployer });
    await instance.setCouponAddress(couponContractAddressV2);
    console.log("Upgraded:", instance.address);
    console.log("Set couponContractAddressV2:", couponContractAddressV2);
};
