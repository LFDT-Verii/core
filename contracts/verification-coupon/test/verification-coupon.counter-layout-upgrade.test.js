const assert = require('node:assert/strict');
const { ethers, upgrades } = require('hardhat');
const { execute } = require('../../test-utils');

describe('VerificationCoupon Counter Layout Upgrade', () => {
  const oneDaySeconds = 60 * 60 * 24;
  const traceId = 'trackingId';
  const ownerDid = 'did:velocity:123';

  it('keeps tokenId tracker value when upgrading from legacy Counter struct layout', async () => {
    const [deployerSigner, primarySigner, operatorSigner, metadataSigner] =
      await ethers.getSigners();

    const primary = await primarySigner.getAddress();
    const operator = await operatorSigner.getAddress();
    const metadataAddress = await metadataSigner.getAddress();
    const expirationTime = Math.floor(Date.now() / 1000) + 30 * oneDaySeconds;

    const Permissions = await ethers.getContractFactory('Permissions', deployerSigner);
    const permissions = await upgrades.deployProxy(Permissions, [], {
      initializer: 'initialize',
      kind: 'transparent',
    });
    await permissions.waitForDeployment();

    const CouponV1 = await ethers.getContractFactory(
      'VerificationCouponCounterLayoutV1',
      deployerSigner,
    );
    const couponV1 = await upgrades.deployProxy(
      CouponV1,
      ['Velocity Verification Coupon', 'https://www.velocitynetwork.foundation/'],
      { initializer: 'initialize', kind: 'transparent' },
    );
    await couponV1.waitForDeployment();

    await execute(couponV1.setPermissionsAddress(await permissions.getAddress()));
    await execute(permissions.addAddressScope(metadataAddress, 'coupon:burn'));
    await execute(permissions.addPrimary(primary, primary, primary));
    await execute(permissions.addAddressScope(primary, 'transactions:write'));
    await execute(
      permissions.connect(primarySigner).addOperatorKey(primary, operator),
    );

    await execute(couponV1.mint(primary, expirationTime, 1, traceId, ownerDid));
    await execute(couponV1.mint(primary, expirationTime, 1, traceId, ownerDid));
    await execute(couponV1.mint(primary, expirationTime, 1, traceId, ownerDid));

    const VerificationCoupon = await ethers.getContractFactory(
      'VerificationCoupon',
      deployerSigner,
    );
    const upgradedCoupon = await upgrades.upgradeProxy(
      await couponV1.getAddress(),
      VerificationCoupon,
      { kind: 'transparent' },
    );

    await execute(
      upgradedCoupon.mint(primary, expirationTime, 1, traceId, ownerDid),
    );

    assert.equal((await upgradedCoupon.balanceOf(primary, 0)).toString(), '1');
    assert.equal((await upgradedCoupon.balanceOf(primary, 1)).toString(), '1');
    assert.equal((await upgradedCoupon.balanceOf(primary, 2)).toString(), '1');
    assert.equal((await upgradedCoupon.balanceOf(primary, 3)).toString(), '1');
  });
});
