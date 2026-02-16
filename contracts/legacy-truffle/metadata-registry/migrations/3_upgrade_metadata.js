
const { map } = require('lodash/fp');
const {
  createHash,
} = require('crypto');
const { upgradeProxy } = require('@openzeppelin/truffle-upgrades');
const truffleConfig = require('../truffle-config.js');
const MetadataRegistry = artifacts.require('MetadataRegistry');

const get2BytesHash = (value) => {
  return `0x${createHash('sha256').update(value).digest('hex').slice(0, 4)}`;
};

const env = process.argv[4] || 'localdocker';
const networkId = truffleConfig.networks[env].network_id;

console.log(`ENV: ${env} Network Id: ${networkId}`);
const contractAddress = require(`../.openzeppelin/unknown-${networkId}.json`).proxies[0].address 
console.log('contractAddress', contractAddress)



module.exports = async function (deployer) {
    const instance = await upgradeProxy(contractAddress, MetadataRegistry, { deployer });
    console.log("Upgraded", instance.address);

    const newFreeCredentialTypes = map(get2BytesHash, ['DriversLicenseV1.0']);
    const currentFreeCredentialTypes = map(get2BytesHash, ['DrivingLicenseV1.0']);

    const statusBefore = await Promise.all([
      instance.isFreeCredentialType(newFreeCredentialTypes[0]),
      instance.isFreeCredentialType(currentFreeCredentialTypes[0])
    ]);
    console.log("isFreeCredentialType() of the new / current credentials: ", statusBefore);

    await instance.addFreeTypes(newFreeCredentialTypes);
    await instance.removeFreeTypes(currentFreeCredentialTypes);
    
    const statusAfter = await Promise.all([
      instance.isFreeCredentialType(newFreeCredentialTypes[0]),
      instance.isFreeCredentialType(currentFreeCredentialTypes[0])
    ]);
    console.log("isFreeCredentialType() of the new / current credentials: ", statusAfter);
};
