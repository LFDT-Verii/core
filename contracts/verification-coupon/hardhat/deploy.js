const path = require('path');
const { ethers, upgrades } = require('hardhat');
const {
  getChainId,
  readManifest,
  resolvePermissionsAddress,
  resolveProxyAddress,
} = require('../../hardhat.deploy-utils');

const tokenName = 'Velocity Verification Coupon';
const baseTokenURI = 'https://www.velocitynetwork.foundation/';

async function main() {
  const chainId = await getChainId(ethers);
  const permissionsAddress = resolvePermissionsAddress(chainId);

  if (!permissionsAddress) {
    throw new Error(
      'Permissions proxy address is required (set PERMISSIONS_PROXY_ADDRESS or provide permissions manifest)',
    );
  }

  const VerificationCoupon = await ethers.getContractFactory(
    'VerificationCoupon',
  );
  const instance = await upgrades.deployProxy(
    VerificationCoupon,
    [tokenName, baseTokenURI],
    {
      kind: 'transparent',
      initializer: 'initialize',
    },
  );
  await instance.waitForDeployment();

  const tx = await instance.setPermissionsAddress(permissionsAddress);
  await tx.wait();

  console.log(`COUPON_PROXY_ADDRESS=${await instance.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
