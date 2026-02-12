const assert = require('node:assert/strict');
const { ethers } = require('hardhat');

const tokenName = 'Velocity Verification Coupon';
const baseTokenURI = 'https://www.velocitynetwork.foundation/';

const execute = async (transactionPromise) => {
  const transaction = await transactionPromise;
  await transaction.wait();
};

const expectRevert = async (action, expectedMessage) => {
  try {
    await action();
    assert.fail(`Expected revert with: ${expectedMessage}`);
  } catch (error) {
    const message = String(error?.message || error);
    assert.ok(
      message.includes(expectedMessage),
      `Expected message "${expectedMessage}", got "${message}"`,
    );
  }
};

const deployPermissions = async () => {
  const Permissions = await ethers.getContractFactory('Permissions');
  const permissions = await Permissions.deploy();
  await permissions.waitForDeployment();
  await execute(permissions.initialize());
  return permissions;
};

const deployCoupon = async (permissionsAddress) => {
  const VerificationCoupon = await ethers.getContractFactory(
    'VerificationCoupon',
  );
  const coupon = await VerificationCoupon.deploy();
  await coupon.waitForDeployment();
  await execute(coupon.initialize(tokenName, baseTokenURI));
  await execute(coupon.setPermissionsAddress(permissionsAddress));
  return coupon;
};

describe('VerificationCoupon Contract Test Suite', () => {
  let signers;
  let primarySigner;
  let operatorSigner;
  let metadataSigner;
  let nonOperatorSigner;
  let permissions;
  let coupon;

  beforeEach(async () => {
    signers = await ethers.getSigners();
    [, primarySigner, operatorSigner, metadataSigner, nonOperatorSigner] =
      signers;

    permissions = await deployPermissions();
    coupon = await deployCoupon(await permissions.getAddress());

    const primary = await primarySigner.getAddress();
    const operator = await operatorSigner.getAddress();
    const metadata = await metadataSigner.getAddress();

    await execute(permissions.addAddressScope(metadata, 'coupon:burn'));
    await execute(permissions.addPrimary(primary, primary, primary));
    await execute(permissions.addAddressScope(primary, 'transactions:write'));
    await execute(
      permissions.connect(primarySigner).addOperatorKey(primary, operator),
    );
  });

  it('constructor values should be initialized', async () => {
    assert.equal(await coupon._getTokenName(), tokenName);
    const minterRole = await coupon.MINTER_ROLE();
    assert.equal(
      minterRole,
      '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6',
    );
  });

  it('should mint and burn with expected permissions', async () => {
    const primary = await primarySigner.getAddress();
    const operator = await operatorSigner.getAddress();
    const nonOperator = await nonOperatorSigner.getAddress();
    const expirationTime = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

    await execute(
      coupon.mint(primary, expirationTime, 3, 'traceId', 'did:velocity:owner'),
    );

    assert.equal(await coupon.balanceOf(primary, 0), 3n);

    await execute(
      coupon
        .connect(metadataSigner)
        .burn(0, 'traceId', 'did:velocity:cao', 'did:velocity:burner', operator),
    );

    assert.equal(await coupon.balanceOf(primary, 0), 2n);

    await expectRevert(
      () =>
        execute(
          coupon
            .connect(primarySigner)
            .burn(0, 'traceId', 'did:velocity:cao', 'did:velocity:burner', operator),
        ),
      'Burn: caller does not have coupon:burn permission',
    );

    await expectRevert(
      () =>
        execute(
          coupon.connect(metadataSigner).burn(
            0,
            'traceId',
            'did:velocity:cao',
            'did:velocity:burner',
            nonOperator,
          ),
        ),
      'Permissions: operator not pointing to a primary',
    );
  });

  it('getTokenId should pick the lowest non-expired token id', async () => {
    const primary = await primarySigner.getAddress();
    const operator = await operatorSigner.getAddress();
    const now = Math.floor(Date.now() / 1000);

    await execute(
      coupon.mint(primary, now - 3600, 1, 'traceId-expired', 'did:velocity:owner'),
    );
    await execute(
      coupon.mint(primary, now + 3600, 1, 'traceId-valid', 'did:velocity:owner'),
    );

    const tokenId = await coupon.getTokenId(operator);
    assert.equal(tokenId, 1n);
  });
});
