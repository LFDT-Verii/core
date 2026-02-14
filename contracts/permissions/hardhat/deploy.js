const { ethers, upgrades } = require('hardhat');

async function main() {
  const Permissions = await ethers.getContractFactory('Permissions');
  const instance = await upgrades.deployProxy(Permissions, [], {
    kind: 'transparent',
    initializer: 'initialize',
  });
  await instance.waitForDeployment();

  const proxyAddress = await instance.getAddress();
  console.log(`PERMISSIONS_PROXY_ADDRESS=${proxyAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
