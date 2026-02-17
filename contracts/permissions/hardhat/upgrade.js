const path = require('path');
const { ethers, upgrades } = require('hardhat');
const {
  getChainId,
  readManifest,
  resolveTxOverrides,
  resolveProxyAddress,
} = require('../../hardhat.deploy-utils');

const packageDir = path.resolve(__dirname, '..');

async function main() {
  const txOverrides = await resolveTxOverrides(ethers);
  const upgradeOptions = { kind: 'transparent' };
  if (Object.keys(txOverrides).length > 0) {
    upgradeOptions.txOverrides = txOverrides;
  }

  const chainId = await getChainId(ethers);
  const manifestData = readManifest(packageDir, chainId);

  const proxyAddress = resolveProxyAddress({
    envVar: 'PERMISSIONS_PROXY_ADDRESS',
    manifest: manifestData?.manifest,
    preferredIndex: 0,
    fallback: 'first',
    label: 'permissions proxy',
  });

  if (!proxyAddress) {
    throw new Error(
      'Failed to resolve permissions proxy address; set PERMISSIONS_PROXY_ADDRESS or ensure it is present in .openzeppelin/unknown-<chainId>.json (script: contracts/permissions/hardhat/upgrade.js).',
    );
  }

  const Permissions = await ethers.getContractFactory('Permissions');
  const instance = await upgrades.upgradeProxy(
    proxyAddress,
    Permissions,
    upgradeOptions,
  );
  await instance.waitForDeployment();

  console.log(`PERMISSIONS_PROXY_ADDRESS=${await instance.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
