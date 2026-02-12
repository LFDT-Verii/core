const path = require('path');
const { ethers, upgrades } = require('hardhat');
const {
  getChainId,
  readManifest,
  resolveProxyAddress,
} = require('../../hardhat.deploy-utils');

const packageDir = path.resolve(__dirname, '..');

async function main() {
  const chainId = await getChainId(ethers);
  const manifestData = readManifest(packageDir, chainId);

  if (!manifestData) {
    throw new Error(
      `Missing manifest file for chain ${chainId} at ${packageDir}/.openzeppelin`,
    );
  }

  const proxyAddress = resolveProxyAddress({
    envVar: 'PERMISSIONS_PROXY_ADDRESS',
    manifest: manifestData.manifest,
    preferredIndex: 0,
    fallback: 'first',
    label: 'permissions proxy',
  });

  if (!proxyAddress) {
    throw new Error(`Unable to resolve permissions proxy address`);
  }

  const Permissions = await ethers.getContractFactory('Permissions');
  const instance = await upgrades.upgradeProxy(proxyAddress, Permissions, {
    kind: 'transparent',
  });
  await instance.waitForDeployment();

  console.log(`PERMISSIONS_PROXY_ADDRESS=${await instance.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
