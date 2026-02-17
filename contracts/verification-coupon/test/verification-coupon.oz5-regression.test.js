const assert = require('node:assert/strict');
const { ethers } = require('hardhat');
const { execute } = require('../../test-utils');

const DEFAULT_ADMIN_ROLE =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

describe('VerificationCoupon OZ5 Regression', () => {
  const oneDaySeconds = 60 * 60 * 24;
  const traceId = 'trackingId';
  const caoDid = 'did:velocity:42';
  const burnerDid = 'did:velocity:321';
  const ownerDid = 'did:velocity:123';

  it('grants admin/minter on initialize and keeps token IDs monotonic after burn', async () => {
    const [deployerSigner, primarySigner, operatorSigner, metadataSigner] =
      await ethers.getSigners();

    const deployer = await deployerSigner.getAddress();
    const primary = await primarySigner.getAddress();
    const operator = await operatorSigner.getAddress();
    const metadataAddress = await metadataSigner.getAddress();

    const Permissions = await ethers.getContractFactory('Permissions', deployerSigner);
    const permissions = await Permissions.deploy();
    await permissions.waitForDeployment();
    await execute(permissions.initialize());

    const VerificationCoupon = await ethers.getContractFactory(
      'VerificationCoupon',
      deployerSigner,
    );
    const coupon = await VerificationCoupon.deploy();
    await coupon.waitForDeployment();
    await execute(
      coupon.initialize(
        'Velocity Verification Coupon',
        'https://www.velocitynetwork.foundation/',
      ),
    );

    const minterRole = await coupon.MINTER_ROLE();
    assert.equal(await coupon.hasRole(DEFAULT_ADMIN_ROLE, deployer), true);
    assert.equal(await coupon.hasRole(minterRole, deployer), true);

    await execute(coupon.setPermissionsAddress(await permissions.getAddress()));
    await execute(permissions.addAddressScope(metadataAddress, 'coupon:burn'));
    await execute(permissions.addPrimary(primary, primary, primary));
    await execute(permissions.addAddressScope(primary, 'transactions:write'));
    await execute(
      permissions.connect(primarySigner).addOperatorKey(primary, operator),
    );

    const expirationTime = Math.floor(Date.now() / 1000) + 30 * oneDaySeconds;

    await execute(coupon.mint(primary, expirationTime, 1, traceId, ownerDid));
    await execute(coupon.mint(primary, expirationTime, 1, traceId, ownerDid));

    await execute(
      coupon
        .connect(metadataSigner)
        .burn(0, traceId, caoDid, burnerDid, operator),
    );

    await execute(coupon.mint(primary, expirationTime, 1, traceId, ownerDid));

    assert.equal((await coupon.balanceOf(primary, 0)).toString(), '0');
    assert.equal((await coupon.balanceOf(primary, 1)).toString(), '1');
    assert.equal((await coupon.balanceOf(primary, 2)).toString(), '1');
  });
});
