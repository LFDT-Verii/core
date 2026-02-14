const path = require('path');
const { ethers, upgrades } = require('hardhat');
const {
  getChainId,
  readManifest,
  resolvePermissionsAddress,
  resolveProxyAddress,
} = require('../../hardhat.deploy-utils');

const packageDir = path.resolve(__dirname, '..');

const resolveRevocationAddress = (chainId) => {
  const manifestData = readManifest(packageDir, chainId);
  return resolveProxyAddress({
    envVar: 'REVOCATION_PROXY_ADDRESS',
    manifest: manifestData?.manifest,
    preferredIndex: 0,
    fallback: 'first',
    label: 'revocation proxy',
  });
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const chainId = await getChainId(ethers);
  const proxyAddress = resolveRevocationAddress(chainId);
  if (!proxyAddress) {
    throw new Error(
      'Revocation proxy address is required (set REVOCATION_PROXY_ADDRESS or provide revocation manifest)',
    );
  }

  const RevocationRegistry = await ethers.getContractFactory(
    'RevocationRegistry',
  );
  const instance = await upgrades.upgradeProxy(proxyAddress, RevocationRegistry, {
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
    const isInitialSet =
      currentPermissionsAddress ===
      '0x0000000000000000000000000000000000000000';

    if (!isInitialSet) {
      const permissions = await ethers.getContractAt(
        'Permissions',
        permissionsAddress,
      );
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

  console.log(`REVOCATION_PROXY_ADDRESS=${await instance.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
