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

  const permissions = await ethers.getContractAt('Permissions', permissionsAddress);
  const currentPermissionsAddress = await instance.getPermissionsAddress();
  if (
    currentPermissionsAddress.toLowerCase() !== permissionsAddress.toLowerCase()
  ) {
    const isInitialSet =
      currentPermissionsAddress ===
      '0x0000000000000000000000000000000000000000';

    if (!isInitialSet) {
      const currentVNF = await permissions.getVNF();
      if (currentVNF.toLowerCase() !== deployerAddress.toLowerCase()) {
        throw new Error(
          `Cannot update permissions address from ${currentPermissionsAddress} to ${permissionsAddress}: ` +
            `deployer ${deployerAddress} is not the current Permissions VNF (${currentVNF}). ` +
            'Run this script with the VNF signer or update the permissions address via the authorized VNF.',
        );
      }
    }

    const setPermissionsTx = await instance.setPermissionsAddress(
      permissionsAddress,
    );
    await setPermissionsTx.wait();
  }
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
