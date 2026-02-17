const assert = require('node:assert/strict');
const { ethers, upgrades } = require('hardhat');
const { execute } = require('../../test-utils');

describe('VerificationCoupon Proxy Upgrade OZ5 Regression', () => {
  const oneDaySeconds = 60 * 60 * 24;
  const traceId = 'trackingId';
  const caoDid = 'did:velocity:42';
  const burnerDid = 'did:velocity:321';
  const ownerDid = 'did:velocity:123';

  it('preserves token state across proxy upgrade', async () => {
    const [deployerSigner, primarySigner, operatorSigner, metadataSigner] =
      await ethers.getSigners();

    const deployer = await deployerSigner.getAddress();
    const primary = await primarySigner.getAddress();
    const operator = await operatorSigner.getAddress();
    const metadataAddress = await metadataSigner.getAddress();

    const Permissions = await ethers.getContractFactory('Permissions', deployerSigner);
    const permissions = await upgrades.deployProxy(Permissions, [], {
      initializer: 'initialize',
      kind: 'transparent',
    });
    await permissions.waitForDeployment();

    const VerificationCoupon = await ethers.getContractFactory(
      'VerificationCoupon',
      deployerSigner,
    );
    const coupon = await upgrades.deployProxy(
      VerificationCoupon,
      ['Velocity Verification Coupon', 'https://www.velocitynetwork.foundation/'],
      { initializer: 'initialize', kind: 'transparent' },
    );
    await coupon.waitForDeployment();

    await execute(coupon.setPermissionsAddress(await permissions.getAddress()));
    await execute(permissions.addAddressScope(metadataAddress, 'coupon:burn'));
    await execute(permissions.addPrimary(primary, primary, primary));
    await execute(permissions.addAddressScope(primary, 'transactions:write'));
    await execute(
      permissions.connect(primarySigner).addOperatorKey(primary, operator),
    );

    const expirationTime = Math.floor(Date.now() / 1000) + 30 * oneDaySeconds;

    await execute(coupon.mint(primary, expirationTime, 1, traceId, ownerDid));
    await execute(
      coupon
        .connect(metadataSigner)
        .burn(0, traceId, caoDid, burnerDid, operator),
    );

    const upgradedCoupon = await upgrades.upgradeProxy(
      await coupon.getAddress(),
      VerificationCoupon,
      { kind: 'transparent' },
    );

    await execute(
      upgradedCoupon.mint(primary, expirationTime, 1, traceId, ownerDid),
    );

    assert.equal((await upgradedCoupon.balanceOf(primary, 0)).toString(), '0');
    assert.equal((await upgradedCoupon.balanceOf(primary, 1)).toString(), '1');
    assert.equal(await upgradedCoupon.getVNF(), deployer);
  });
});
