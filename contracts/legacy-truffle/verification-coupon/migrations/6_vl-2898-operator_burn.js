const truffleConfig = require('../truffle-config.js');
const { upgradeProxy } = require('@openzeppelin/truffle-upgrades');
const VerificationCoupon = artifacts.require("VerificationCoupon");

const env = process.argv[4] || 'localdocker';
console.log(process.argv[2])
console.log('ENV:', env)
const networkId = truffleConfig.networks[env].network_id;

const contractAddress = require(`../.openzeppelin/unknown-${networkId}.json`).proxies[1].address

console.log(`ENV: ${env} Network Id: ${networkId}`);

module.exports = async function (deployer) {
    const instance = await upgradeProxy(contractAddress, VerificationCoupon, { deployer });
    console.log('Upgraded', instance.address);
};
