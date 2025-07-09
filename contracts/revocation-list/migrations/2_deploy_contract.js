const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const RevocationRegistry = artifacts.require("RevocationRegistry");

module.exports = async function (deployer) {
  const instance = await deployProxy(RevocationRegistry, [], { deployer });
  console.log('Deployed', instance.address);
};

