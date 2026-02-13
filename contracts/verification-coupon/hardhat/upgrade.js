const path = require('path');
const { ethers, upgrades } = require('hardhat');
const {
  getChainId,
  readManifest,
  resolvePermissionsAddress,
  resolveProxyAddress,
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
  const instance = await upgrades.upgradeProxy(proxyAddress, VerificationCoupon, {
    kind: 'transparent',
  });
  await instance.waitForDeployment();

  const permissionsAddress = resolvePermissionsAddress(chainId);
  if (permissionsAddress) {
    let shouldUpdatePermissionsAddress = true;
    if (typeof instance.getPermissionsAddress === 'function') {
      const currentPermissionsAddress = await instance.getPermissionsAddress();
      shouldUpdatePermissionsAddress =
        !currentPermissionsAddress ||
        currentPermissionsAddress.toLowerCase() !== permissionsAddress.toLowerCase();
    }

    if (shouldUpdatePermissionsAddress) {
      const tx = await instance.setPermissionsAddress(permissionsAddress);
      await tx.wait();
    }
  }

  console.log(`COUPON_PROXY_ADDRESS=${await instance.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
