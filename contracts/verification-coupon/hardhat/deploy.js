const { ethers, upgrades } = require('hardhat');
const {
  getChainId,
  resolvePermissionsAddress,
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

  try {
    const tx = await instance.setPermissionsAddress(permissionsAddress);
    await tx.wait();
  } catch (error) {
    const originalMessage =
      error && typeof error.message === 'string'
        ? error.message
        : String(error);
    throw new Error(
      `Failed to set permissions address on verification-coupon proxy ${await instance.getAddress()} to ${permissionsAddress}. ` +
        `Ensure the deployer is authorized to call setPermissionsAddress. Original error: ${originalMessage}`,
    );
  }

  console.log(`COUPON_PROXY_ADDRESS=${await instance.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
