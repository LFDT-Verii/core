const path = require('path');
const { ethers, upgrades } = require('hardhat');
const {
  getChainId,
  readManifest,
  resolvePermissionsAddress,
  resolveProxyAddress,
} = require('../../hardhat.deploy-utils');

const packageDir = path.resolve(__dirname, '..');

const resolveMetadataAddress = (chainId) => {
  const manifestData = readManifest(packageDir, chainId);
  return resolveProxyAddress({
    envVar: 'METADATA_PROXY_ADDRESS',
    manifest: manifestData?.manifest,
    preferredIndex: 0,
    fallback: 'first',
    label: 'metadata proxy',
  });
};

async function main() {
  const chainId = await getChainId(ethers);
  const proxyAddress = resolveMetadataAddress(chainId);
  if (!proxyAddress) {
    throw new Error(
      'Metadata proxy address is required (set METADATA_PROXY_ADDRESS or provide metadata manifest)',
    );
  }

  const MetadataRegistry = await ethers.getContractFactory('MetadataRegistry');
  const instance = await upgrades.upgradeProxy(proxyAddress, MetadataRegistry, {
    kind: 'transparent',
  });
  await instance.waitForDeployment();

  const permissionsAddress = resolvePermissionsAddress(chainId);
  if (!permissionsAddress) {
    throw new Error(
      'Permissions proxy address is required (set PERMISSIONS_PROXY_ADDRESS or provide permissions manifest)',
    );
  }

  const currentPermissionsAddress = await instance.getPermissionsAddress();
  if (
    currentPermissionsAddress.toLowerCase() !== permissionsAddress.toLowerCase()
  ) {
    const setPermissionsTx = await instance.setPermissionsAddress(
      permissionsAddress,
    );
    await setPermissionsTx.wait();
  }

  const permissions = await ethers.getContractAt('Permissions', permissionsAddress);
  const metadataAddress = await instance.getAddress();
  const hasBurnScope = await permissions.checkAddressScope(
    metadataAddress,
    'coupon:burn',
  );
  if (!hasBurnScope) {
    const addScopeTx = await permissions.addAddressScope(
      metadataAddress,
      'coupon:burn',
    );
    await addScopeTx.wait();
  }

  console.log(`METADATA_PROXY_ADDRESS=${metadataAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
