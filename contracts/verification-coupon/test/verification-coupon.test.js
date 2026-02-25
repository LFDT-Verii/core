const assert = require('node:assert/strict');
const { ethers } = require('hardhat');
const { execute, expectRevert, findEvent } = require('../../test-utils');

const setupContracts = async ({
  metadataContractAddress,
  primary,
  deployerSigner,
}) => {
  const Permissions = await ethers.getContractFactory(
    'Permissions',
    deployerSigner,
  );
  const permissionsContractInstance = await Permissions.deploy();
  await permissionsContractInstance.waitForDeployment();
  await execute(permissionsContractInstance.initialize());

  const VerificationCoupon = await ethers.getContractFactory(
    'VerificationCoupon',
    deployerSigner,
  );
  const verificationCouponInstance = await VerificationCoupon.deploy();
  await verificationCouponInstance.waitForDeployment();
  await execute(
    verificationCouponInstance.initialize(
      'Velocity Verification Coupon',
      'https://www.velocitynetwork.foundation/',
    ),
  );
  await execute(
    verificationCouponInstance.setPermissionsAddress(
      await permissionsContractInstance.getAddress(),
    ),
  );

  await execute(
    permissionsContractInstance.addAddressScope(
      metadataContractAddress,
      'coupon:burn',
    ),
  );
  await execute(
    permissionsContractInstance.addPrimary(primary, primary, primary),
  );
  await execute(
    permissionsContractInstance.addAddressScope(primary, 'transactions:write'),
  );

  return { permissionsContractInstance, verificationCouponInstance };
};

describe('VerificationCoupon Contract Test Suite', () => {
  const oneDaySeconds = 60 * 60 * 24;
  const expirationTime = Math.floor(Date.now() / 1000) + 30 * oneDaySeconds;
  const expiredTime = expirationTime - 60 * oneDaySeconds;
  const traceId = 'trackingId';
  const caoDid = 'did:velocity:42';
  const burnerDid = 'did:velocity:456';
  const ownerDid = 'did:velocity:456';

  describe('VerificationCoupon', () => {
    let signers;
    let deployerSigner;
    let primarySigner;
    let operatorSigner;
    let metadataSigner;

    let tokenOwner;
    let primaryAccount;
    let operatorAccount;
    let mockMetadataContractAddress;

    let permissionsContractInstance;
    let verificationCouponInstance;

    before(async () => {
      signers = await ethers.getSigners();
      [deployerSigner, primarySigner, operatorSigner, metadataSigner] = signers;

      tokenOwner = await primarySigner.getAddress();
      primaryAccount = tokenOwner;
      operatorAccount = await operatorSigner.getAddress();
      mockMetadataContractAddress = await metadataSigner.getAddress();

      ({ permissionsContractInstance, verificationCouponInstance } =
        await setupContracts({
          metadataContractAddress: mockMetadataContractAddress,
          primary: primaryAccount,
          deployerSigner,
        }));

      await execute(
        permissionsContractInstance
          .connect(primarySigner)
          .addOperatorKey(primaryAccount, operatorAccount),
      );
    });

    describe('constructor', () => {
      it('Verification Coupon contract should be correctly deployed', async () => {
        assert.equal(
          await verificationCouponInstance._getTokenName(),
          'Velocity Verification Coupon',
          'value was not ok',
        );
      });

      it('Broker role is currently', async () => {
        assert.equal(
          await verificationCouponInstance.MINTER_ROLE(),
          '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6',
          'value was not ok',
        );
      });
    });

    describe('Mint new token', () => {
      const quantity = 3;

      it('New token minted with id 0 & 1 by Contract owner', async () => {
        await execute(
          verificationCouponInstance.mint(
            tokenOwner,
            expirationTime,
            quantity,
            traceId,
            ownerDid,
          ),
        );
        await execute(
          verificationCouponInstance.mint(
            tokenOwner,
            expirationTime,
            quantity,
            traceId,
            ownerDid,
          ),
        );
      });

      it('Burn token with id 0 of token owner by operator via metadata contract', async () => {
        await execute(
          verificationCouponInstance
            .connect(metadataSigner)
            .burn(0, traceId, caoDid, burnerDid, operatorAccount),
        );
      });

      it('Burn token with id 0 of token owner by non-operator via metadata contract fails', async () => {
        await expectRevert(
          () =>
            execute(
              verificationCouponInstance
                .connect(metadataSigner)
                .burn(0, traceId, caoDid, burnerDid, primaryAccount),
            ),
          'Permissions: operator not pointing to a primary',
        );
      });

      it('Burn token with id 0 by contract deployer fails', async () => {
        await expectRevert(
          () =>
            execute(
              verificationCouponInstance.burn(
                0,
                traceId,
                caoDid,
                burnerDid,
                operatorAccount,
              ),
            ),
          'Burn: caller does not have coupon:burn permission',
        );
      });

      it('Burn token with id 0 by any account without permission - rejected!', async () => {
        const accountWithoutTokens = await signers[4].getAddress();
        await expectRevert(
          () =>
            execute(
              verificationCouponInstance
                .connect(signers[4])
                .burn(0, traceId, caoDid, burnerDid, accountWithoutTokens),
            ),
          'Burn: caller does not have coupon:burn permission',
        );
      });
    });
  });

  describe('VerificationCoupon', () => {
    let signers;
    let deployerSigner;
    let issuerSigner;
    let operatorSigner;
    let metadataSigner;

    let issuer;
    let primaryAccount;
    let operatorAccount;
    let mockMetadataContractAddress;

    const quantity = 1;
    let permissionsContractInstance;
    let verificationCouponInstance;

    before(async () => {
      signers = await ethers.getSigners();
      [deployerSigner, , issuerSigner, operatorSigner, metadataSigner] =
        signers;

      issuer = await issuerSigner.getAddress();
      primaryAccount = issuer;
      operatorAccount = await operatorSigner.getAddress();
      mockMetadataContractAddress = await metadataSigner.getAddress();

      ({ permissionsContractInstance, verificationCouponInstance } =
        await setupContracts({
          metadataContractAddress: mockMetadataContractAddress,
          primary: primaryAccount,
          deployerSigner,
        }));

      await execute(
        permissionsContractInstance
          .connect(issuerSigner)
          .addOperatorKey(primaryAccount, operatorAccount),
      );
    });

    describe('Check contract owner rights', () => {
      it("Account don't have minter role", async () => {
        assert.equal(
          await verificationCouponInstance.hasRole(
            '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6',
            issuer,
          ),
          false,
          'this account has minter rights',
        );
      });

      it('Add new minter', async () => {
        await execute(
          verificationCouponInstance.grantRole(
            '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6',
            issuer,
          ),
        );
        assert.equal(
          await verificationCouponInstance.hasRole(
            '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6',
            issuer,
          ),
          true,
          'Account dont have minter role',
        );
      });

      it('VNF burn token created by allowed account', async () => {
        await execute(
          verificationCouponInstance
            .connect(issuerSigner)
            .mint(issuer, expirationTime, quantity, traceId, ownerDid),
        );
        await execute(
          verificationCouponInstance
            .connect(metadataSigner)
            .burn(0, traceId, caoDid, burnerDid, operatorAccount),
        );
      });
    });

    describe('Token Info', () => {
      it('Token expired', async () => {
        await execute(
          verificationCouponInstance
            .connect(issuerSigner)
            .mint(issuer, expiredTime, quantity, traceId, ownerDid),
        );
        assert.equal(
          await verificationCouponInstance.isExpired(1),
          true,
          'Token expired',
        );
      });

      it('Token not expired', async () => {
        await execute(
          verificationCouponInstance
            .connect(issuerSigner)
            .mint(issuer, expirationTime, quantity, traceId, ownerDid),
        );
        assert.equal(
          await verificationCouponInstance.isExpired(2),
          false,
          'Token actual',
        );
      });
    });
  });

  describe('VerificationCoupon', () => {
    let signers;
    let deployerSigner;
    let primarySigner;
    let operatorSigner;
    let metadataSigner;

    let primaryAccount;
    let operatorAccount;
    let mockMetadataContractAddress;

    let permissionsContractInstance;
    let verificationCouponInstance;

    before(async () => {
      signers = await ethers.getSigners();
      [deployerSigner, primarySigner, operatorSigner, metadataSigner] = signers;

      primaryAccount = await primarySigner.getAddress();
      operatorAccount = await operatorSigner.getAddress();
      mockMetadataContractAddress = await metadataSigner.getAddress();

      ({ permissionsContractInstance, verificationCouponInstance } =
        await setupContracts({
          metadataContractAddress: mockMetadataContractAddress,
          primary: primaryAccount,
          deployerSigner,
        }));
      await execute(
        permissionsContractInstance
          .connect(primarySigner)
          .addOperatorKey(primaryAccount, operatorAccount),
      );
    });

    describe('Mint new token bundle', () => {
      const quantity = 3;

      it('New token bundle minted', async () => {
        const receipt = await execute(
          verificationCouponInstance.mint(
            primaryAccount,
            expirationTime,
            quantity,
            traceId,
            ownerDid,
          ),
        );

        const mintEvent = findEvent(
          receipt,
          verificationCouponInstance,
          'MintCouponBundle',
        );
        assert.ok(mintEvent, 'MintCouponBundle event was not emitted');
      });

      it('Burn token from new bundle by operator account', async () => {
        await execute(
          verificationCouponInstance
            .connect(metadataSigner)
            .burn(0, traceId, caoDid, burnerDid, operatorAccount),
        );
        await execute(
          verificationCouponInstance
            .connect(metadataSigner)
            .burn(0, traceId, caoDid, burnerDid, operatorAccount),
        );
        const receipt = await execute(
          verificationCouponInstance
            .connect(metadataSigner)
            .burn(0, traceId, caoDid, burnerDid, operatorAccount),
        );

        const burnEvent = findEvent(
          receipt,
          verificationCouponInstance,
          'BurnCoupon',
        );
        assert.ok(burnEvent, 'BurnCoupon event was not emitted');

        const block = await ethers.provider.getBlock(receipt.blockNumber);

        assert.equal(burnEvent.args.owner, primaryAccount);
        assert.equal(burnEvent.args.bundleId, 0n);
        assert.equal(burnEvent.args.balance, 0n);
        assert.equal(burnEvent.args.expirationTime, BigInt(expirationTime));
        assert.equal(burnEvent.args.burnTime, BigInt(block.timestamp));
      });

      it('Throw an error if quantity is invalid', async () => {
        await expectRevert(
          () =>
            execute(
              verificationCouponInstance.mint(
                primaryAccount,
                expirationTime,
                0,
                traceId,
                ownerDid,
              ),
            ),
          'Invalid quantity',
        );
      });
    });

    describe('Get tokens', () => {
      const quantity = 3;
      const secondCouponId = 1;

      it('Get the unused coupon for the account', async () => {
        await execute(
          verificationCouponInstance.mint(
            primaryAccount,
            expirationTime,
            quantity,
            traceId,
            ownerDid,
          ),
        );
        await execute(
          verificationCouponInstance.mint(
            primaryAccount,
            expirationTime,
            quantity,
            traceId,
            ownerDid,
          ),
        );
        const couponId =
          await verificationCouponInstance.getTokenId(operatorAccount);
        assert.equal(
          Number(couponId),
          secondCouponId,
          'It is not the first unused coupon!',
        );
      });

      it('Get the next unused coupon when the previous was burned', async () => {
        await execute(
          verificationCouponInstance.mint(
            primaryAccount,
            expirationTime,
            quantity,
            traceId,
            ownerDid,
          ),
        );

        const tokenIds = [1, 1, 1, 2, 2, 2, 3, 3, 3];
        for (let i = 0; i < tokenIds.length; i += 1) {
          const couponId =
            await verificationCouponInstance.getTokenId(operatorAccount);
          await execute(
            verificationCouponInstance
              .connect(metadataSigner)
              .burn(couponId, traceId, caoDid, burnerDid, operatorAccount),
          );
          assert.equal(
            Number(couponId),
            tokenIds[i],
            'It is not the first unused coupon!',
          );
        }
      });

      it('Mint and burn one token in loop', async () => {
        for (let i = 4; i < 9; i += 1) {
          await execute(
            verificationCouponInstance.mint(
              primaryAccount,
              expirationTime,
              1,
              traceId,
              ownerDid,
            ),
          );
          const couponId =
            await verificationCouponInstance.getTokenId(operatorAccount);
          await execute(
            verificationCouponInstance
              .connect(metadataSigner)
              .burn(couponId, traceId, caoDid, burnerDid, operatorAccount),
          );
          assert.equal(
            Number(couponId),
            i,
            'It is not the first unused coupon!',
          );
        }
      });

      it('Mint and burn one by one and ignore expired minting', async () => {
        const tokenIds = [9, 11, 13];

        for (let i = 0; i < 3; i += 1) {
          await execute(
            verificationCouponInstance.mint(
              primaryAccount,
              expirationTime,
              1,
              traceId,
              ownerDid,
            ),
          );
          await execute(
            verificationCouponInstance.mint(
              primaryAccount,
              expiredTime,
              1,
              traceId,
              ownerDid,
            ),
          );

          const couponId =
            await verificationCouponInstance.getTokenId(operatorAccount);
          await execute(
            verificationCouponInstance
              .connect(metadataSigner)
              .burn(couponId, traceId, caoDid, burnerDid, operatorAccount),
          );
          assert.equal(
            Number(couponId),
            tokenIds[i],
            'It is not the first unused coupon!',
          );
        }
      });

      it('Throw an error if the account without tokens', async () => {
        await expectRevert(
          () => verificationCouponInstance.getTokenId(operatorAccount),
          'No available tokens',
        );
      });

      it('Error if primary tries to retrieve its own tokens, not as an operator', async () => {
        await expectRevert(
          () => verificationCouponInstance.getTokenId(primaryAccount),
          'Permissions: operator not pointing to a primary',
        );
      });
    });
  });

  describe('VerificationCoupon', () => {
    let signers;
    let deployerSigner;
    let primarySigner;
    let operatorSigner;
    let metadataSigner;

    let primaryAccount;
    let operatorAccount;
    let mockMetadataContractAddress;

    let permissionsContractInstance;
    let verificationCouponInstance;

    before(async () => {
      signers = await ethers.getSigners();
      [deployerSigner, primarySigner, operatorSigner, metadataSigner] = signers;

      primaryAccount = await primarySigner.getAddress();
      operatorAccount = await operatorSigner.getAddress();
      mockMetadataContractAddress = await metadataSigner.getAddress();

      ({ permissionsContractInstance, verificationCouponInstance } =
        await setupContracts({
          metadataContractAddress: mockMetadataContractAddress,
          primary: primaryAccount,
          deployerSigner,
        }));
      await execute(
        permissionsContractInstance
          .connect(primarySigner)
          .addOperatorKey(primaryAccount, operatorAccount),
      );
    });

    describe('Burn expired tokens', () => {
      const quantity = 100;
      const firstCouponId = 2;

      it('Burn two expired bundles', async () => {
        await execute(
          verificationCouponInstance.mint(
            primaryAccount,
            expiredTime,
            quantity,
            traceId,
            ownerDid,
          ),
        );
        await execute(
          verificationCouponInstance.mint(
            primaryAccount,
            expiredTime,
            quantity,
            traceId,
            ownerDid,
          ),
        );
        await execute(
          verificationCouponInstance.mint(
            primaryAccount,
            expirationTime,
            quantity,
            traceId,
            ownerDid,
          ),
        );

        const couponId =
          await verificationCouponInstance.getTokenId(operatorAccount);
        assert.equal(
          Number(couponId),
          firstCouponId,
          'It is not the first unused coupon!',
        );

        assert.equal(
          await verificationCouponInstance.balanceOf(primaryAccount, 0),
          100n,
        );
        assert.equal(
          await verificationCouponInstance.balanceOf(primaryAccount, 1),
          100n,
        );

        await execute(
          verificationCouponInstance
            .connect(metadataSigner)
            .burn(firstCouponId, traceId, caoDid, burnerDid, operatorAccount),
        );

        assert.equal(
          await verificationCouponInstance.balanceOf(primaryAccount, 0),
          0n,
        );
        assert.equal(
          await verificationCouponInstance.balanceOf(primaryAccount, 1),
          0n,
        );
      });
    });
  });

  describe('getTokenId handle token found, but all tokens are expired', () => {
    describe('VerificationCoupon', () => {
      let signers;
      let deployerSigner;
      let primarySigner;
      let operatorSigner;
      let metadataSigner;

      let primaryAccount;
      let operatorAccount;
      let mockMetadataContractAddress;

      let permissionsContractInstance;
      let verificationCouponInstance;

      before(async () => {
        signers = await ethers.getSigners();
        [deployerSigner, primarySigner, operatorSigner, metadataSigner] =
          signers;

        primaryAccount = await primarySigner.getAddress();
        operatorAccount = await operatorSigner.getAddress();
        mockMetadataContractAddress = await metadataSigner.getAddress();

        ({ permissionsContractInstance, verificationCouponInstance } =
          await setupContracts({
            metadataContractAddress: mockMetadataContractAddress,
            primary: primaryAccount,
            deployerSigner,
          }));

        await execute(
          permissionsContractInstance
            .connect(primarySigner)
            .addOperatorKey(primaryAccount, operatorAccount),
        );
      });

      it('should error when no unexpired tokens exist', async () => {
        const quantity = 1;
        await execute(
          verificationCouponInstance.mint(
            primaryAccount,
            expiredTime,
            quantity,
            traceId,
            ownerDid,
          ),
        );
        await expectRevert(
          () => verificationCouponInstance.getTokenId(operatorAccount),
          'No available tokens',
        );
      });
    });
  });
});
