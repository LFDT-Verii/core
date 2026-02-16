const assert = require('node:assert/strict');
const path = require('path');
const { ethers } = require('hardhat');
const {
  assertAddressEqual,
  assertHasCode,
  resolveManagedProxy,
  smokeEnabled,
} = require('../../../test-utils/post-upgrade-smoke');

const describeSmoke = smokeEnabled() ? describe : describe.skip;

describeSmoke('VerificationCoupon post-upgrade smoke', function () {
  this.timeout(120000);

  it('resolves deployed proxies and validates permissions wiring', async () => {
    const couponPackageDir = path.resolve(__dirname, '../..');
    const permissionsPackageDir = path.resolve(__dirname, '../../../permissions');

    const explicitIndex = Number(process.env.COUPON_PROXY_INDEX);
    const preferredCouponIndex = Number.isInteger(explicitIndex) ? explicitIndex : 1;

    const { address: permissionsAddress, chainId } = await resolveManagedProxy({
      ethers,
      packageDir: permissionsPackageDir,
      envVar: 'PERMISSIONS_PROXY_ADDRESS',
      preferredIndex: 0,
      fallback: 'first',
      label: 'permissions proxy',
    });
    const { address: couponAddress } = await resolveManagedProxy({
      ethers,
      packageDir: couponPackageDir,
      envVar: 'COUPON_PROXY_ADDRESS',
      preferredIndex: preferredCouponIndex,
      fallback: 'last',
      label: 'verification-coupon proxy',
    });

    await assertHasCode(ethers, permissionsAddress, 'permissions proxy');
    await assertHasCode(ethers, couponAddress, 'verification-coupon proxy');

    const coupon = await ethers.getContractAt('VerificationCoupon', couponAddress);
    const currentPermissionsAddress = await coupon.getPermissionsAddress();
    assertAddressEqual(
      currentPermissionsAddress,
      permissionsAddress,
      `VerificationCoupon permissions wiring on chain ${chainId}`,
    );

    const tokenName = await coupon._getTokenName();
    assert.notEqual(tokenName, '', 'VerificationCoupon token name should not be empty');
  });
});
