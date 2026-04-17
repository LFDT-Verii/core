const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const RevocationRegistry = artifacts.require('RevocationRegistry');

module.exports = async (deployer) => {
  const instance = await deployProxy(RevocationRegistry, [], { deployer });
  console.log('Deployed', instance.address);
};
