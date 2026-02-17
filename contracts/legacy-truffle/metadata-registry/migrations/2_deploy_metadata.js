
const { map } = require('lodash/fp');
const {
  createHash,
} = require('crypto');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const MetadataRegistry = artifacts.require('MetadataRegistry');
const truffleConfig = require('../truffle-config.js');

const freeCredentialTypesList = ['Email', 'EmailV1.0', 'Phone', 'PhoneV1.0', 'IdDocument', 'IdDocumentV1.0', 'PassportV1.0', 'DriversLicenseV1.0', 'NationalIdCardV1.0', 'ProofOfAgeV1.0', 'ResidentPermitV1.0', 'VerificationIdentifier']

const get2BytesHash = (value) => {
  return `0x${createHash('sha256').update(value).digest('hex').slice(0, 4)}`;
};
const env = process.argv[4] || 'localdocker';
const networkId = truffleConfig.networks[env].network_id;

console.log(`ENV: ${env} Network Id: ${networkId}`);


const couponContractAddressV1 = require(`../../verification-coupon/.openzeppelin/unknown-${networkId}.json`).proxies[0].address;

module.exports = async function (deployer) {
    const instance = await deployProxy(MetadataRegistry, [
      couponContractAddressV1,
      map(get2BytesHash, freeCredentialTypesList)
    ], { deployer });
    console.log('Deployed', instance.address);
};
