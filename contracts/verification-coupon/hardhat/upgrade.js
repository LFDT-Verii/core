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

const resolveCouponProxyAddress = (chainId) => {
  const manifestData = readManifest(packageDir, chainId);

  const explicitIndex = Number(process.env.COUPON_PROXY_INDEX);
  const preferredIndex = Number.isInteger(explicitIndex) ? explicitIndex : 1;

  return resolveProxyAddress({
    envVar: 'COUPON_PROXY_ADDRESS',
    manifest: manifestData?.manifest,
    preferredIndex,
    fallback: 'last',
    label: 'verification-coupon proxy',
  });
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const txOverrides = await resolveTxOverrides(ethers);
  const upgradeOptions = { kind: 'transparent' };
  if (Object.keys(txOverrides).length > 0) {
    upgradeOptions.txOverrides = txOverrides;
  }

  const chainId = await getChainId(ethers);
  const proxyAddress = resolveCouponProxyAddress(chainId);
  if (!proxyAddress) {
    throw new Error(
      'Verification-coupon proxy address is required (set COUPON_PROXY_ADDRESS or provide coupon manifest)',
    );
  }

  const VerificationCoupon = await ethers.getContractFactory(
    'VerificationCoupon',
  );
  const instance = await upgrades.upgradeProxy(
    proxyAddress,
    VerificationCoupon,
    upgradeOptions,
  );
  await instance.waitForDeployment();

  const permissionsAddress = resolvePermissionsAddress(chainId);
  if (!permissionsAddress) {
    throw new Error(
      'Permissions proxy address is required (set PERMISSIONS_PROXY_ADDRESS or provide permissions manifest)',
    );
  }

  let shouldUpdatePermissionsAddress = true;
  let currentPermissionsAddress = null;
  if (typeof instance.getPermissionsAddress === 'function') {
    currentPermissionsAddress = await instance.getPermissionsAddress();
    shouldUpdatePermissionsAddress =
      !currentPermissionsAddress ||
      currentPermissionsAddress.toLowerCase() !== permissionsAddress.toLowerCase();
  }

  if (shouldUpdatePermissionsAddress) {
    try {
      await instance.setPermissionsAddress.staticCall(permissionsAddress);
    } catch (error) {
      const originalMessage =
        error && typeof error.message === 'string'
          ? error.message
          : String(error);
      throw new Error(
        `Cannot update coupon permissions address from ${currentPermissionsAddress || 'unavailable'} to ${permissionsAddress}. ` +
          `Signer ${deployerAddress} is not authorized to call setPermissionsAddress. ` +
          `Run with an authorized signer. Original error: ${originalMessage}`,
      );
    }

    const tx = await instance.setPermissionsAddress(
      permissionsAddress,
      txOverrides,
    );
    await tx.wait();
  }

  console.log(`COUPON_PROXY_ADDRESS=${await instance.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
