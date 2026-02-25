const path = require('path');
const { ethers, upgrades } = require('hardhat');
const {
  getChainId,
  readManifest,
  resolvePermissionsAddress,
  resolveProxyAddress,
  resolveTxOverrides,
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

const main = async () => {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const txOverrides = await resolveTxOverrides(ethers);
  const upgradeOptions = { kind: 'transparent' };
  if (Object.keys(txOverrides).length > 0) {
    upgradeOptions.txOverrides = txOverrides;
  }

  const chainId = await getChainId(ethers);
  const proxyAddress = resolveRevocationAddress(chainId);
  if (!proxyAddress) {
    throw new Error(
      'Revocation proxy address is required (set REVOCATION_PROXY_ADDRESS or provide revocation manifest)',
    );
  }

  const RevocationRegistry =
    await ethers.getContractFactory('RevocationRegistry');
  const instance = await upgrades.upgradeProxy(
    proxyAddress,
    RevocationRegistry,
    upgradeOptions,
  );
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
        `Cannot update revocation permissions address from ${currentPermissionsAddress} to ${permissionsAddress}. ` +
          `Signer ${deployerAddress} is not authorized to call setPermissionsAddress. ` +
          `Run with an authorized signer. Original error: ${originalMessage}`,
      );
    }

    const setPermissionsTx = await instance.setPermissionsAddress(
      permissionsAddress,
      txOverrides,
    );
    await setPermissionsTx.wait();
  }

  console.log(`REVOCATION_PROXY_ADDRESS=${await instance.getAddress()}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
