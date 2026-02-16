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
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
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
    try {
      await instance.setPermissionsAddress.staticCall(permissionsAddress);
    } catch (error) {
      const originalMessage =
        error && typeof error.message === 'string'
          ? error.message
          : String(error);
      throw new Error(
        `Cannot update metadata permissions address from ${currentPermissionsAddress} to ${permissionsAddress}. ` +
          `Signer ${deployerAddress} is not authorized to call setPermissionsAddress. ` +
          `Run with an authorized signer. Original error: ${originalMessage}`,
      );
    }

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
    try {
      const addScopeTx = await permissions.addAddressScope(
        metadataAddress,
        'coupon:burn',
      );
      await addScopeTx.wait();
    } catch (error) {
      throw new Error(
        `Failed to grant 'coupon:burn' scope to metadata registry at ${metadataAddress} via permissions proxy ${permissionsAddress}. ` +
          `Ensure the deployer is authorized to modify scopes. Original error: ${error && error.message ? error.message : String(error)}`,
      );
    }
  }

  console.log(`METADATA_PROXY_ADDRESS=${metadataAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
