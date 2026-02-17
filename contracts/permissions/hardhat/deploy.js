const { ethers, upgrades } = require('hardhat');
const { resolveTxOverrides } = require('../../hardhat.deploy-utils');

async function main() {
  const txOverrides = await resolveTxOverrides(ethers);
  const deployOptions = {
    kind: 'transparent',
    initializer: 'initialize',
  };
  if (Object.keys(txOverrides).length > 0) {
    deployOptions.txOverrides = txOverrides;
  }

  const Permissions = await ethers.getContractFactory('Permissions');
  const instance = await upgrades.deployProxy(Permissions, [], deployOptions);
  await instance.waitForDeployment();

  const proxyAddress = await instance.getAddress();
  console.log(`PERMISSIONS_PROXY_ADDRESS=${proxyAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
