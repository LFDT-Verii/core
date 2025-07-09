const truffleAssert = require('truffle-assertions');

const VerificationCoupon = artifacts.require(
  '../contracts/VerificationCoupon.sol'
);
const Permissions = artifacts.require(
  '../../permissions/contracts/Permissions.sol'
);

const setupContracts = async (metadataContractAddress, primary) => {
  const permissionsContractInstance = await Permissions.new();
  await permissionsContractInstance.initialize();
  const verificationCouponInstance = await VerificationCoupon.new();
  await verificationCouponInstance.initialize(
    'Velocity Verification Coupon',
    'https://www.velocitynetwork.foundation/'
  );
  await verificationCouponInstance.setPermissionsAddress(
    permissionsContractInstance.address
  );
  await permissionsContractInstance.addAddressScope(
    metadataContractAddress,
    'coupon:burn'
  );
  await permissionsContractInstance.addPrimary(primary, primary, primary);
  await permissionsContractInstance.addAddressScope(
    primary,
    'transactions:write'
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

  contract('VerificationCoupon', (accounts) => {
    const deployerAccount = accounts[0];
    const tokenOwner = accounts[1];
    const primaryAccount = tokenOwner;
    const permissionsAccount = primaryAccount;
    const operatorAccount = accounts[2];
    const mockMetadataContractAddress = accounts[3];
    let permissionsContractInstance;
    let verificationCouponInstance;
    before(async () => {
      ({ permissionsContractInstance, verificationCouponInstance } =
        await setupContracts(mockMetadataContractAddress, primaryAccount));
      await permissionsContractInstance.addOperatorKey(
        primaryAccount,
        operatorAccount,
        { from: permissionsAccount }
      );
    });
    describe('constructor', () => {
      it('Verification Coupon contract should be correctly deployed', async () => {
        assert.equal(
          await verificationCouponInstance._getTokenName(),
          'Velocity Verification Coupon',
          'value was not ok'
        );
      });
      it('Broker role is currently', async () => {
        assert.equal(
          await verificationCouponInstance.MINTER_ROLE(),
          '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6',
          'value was not ok'
        );
      });
    });
    describe('Mint new token', () => {
      const quantity = 3;
      it('New token minted with id 0 & 1 by Contract owner', async () => {
        await verificationCouponInstance.mint(
          tokenOwner,
          expirationTime,
          quantity,
          traceId,
          ownerDid,
          {
            from: deployerAccount,
          }
        );
        await verificationCouponInstance.mint(
          tokenOwner,
          expirationTime,
          quantity,
          traceId,
          ownerDid,
          {
            from: deployerAccount,
          }
        );
      });
      it('Burn token with id 0 of token owner by operator via metadata contract', async () => {
        await verificationCouponInstance.burn(
          0,
          traceId,
          caoDid,
          burnerDid,
          operatorAccount,
          {
            from: mockMetadataContractAddress,
          }
        );
      });
      it('Burn token with id 0 of token owner by non-operator via metadata contract fails', async () => {
        await truffleAssert.fails(
          verificationCouponInstance.burn(
            0,
            traceId,
            caoDid,
            burnerDid,
            primaryAccount,
            {
              from: mockMetadataContractAddress,
            }
          ),
          'Permissions: operator not pointing to a primary'
        );
      });
      it('Burn token with id 0 by contract deployer fails', async () => {
        await truffleAssert.fails(
          verificationCouponInstance.burn(
            0,
            traceId,
            caoDid,
            burnerDid,
            operatorAccount,
            {
              from: deployerAccount,
            }
          ),
          'Burn: caller does not have coupon:burn permission'
        );
      });
      it('Burn token with id 1 by any account without permission - rejected!', async () => {
        const accountWithoutTokens = accounts[4];
        await truffleAssert.fails(
          verificationCouponInstance.burn(
            0,
            traceId,
            caoDid,
            burnerDid,
            accountWithoutTokens,
            { from: accountWithoutTokens }
          ),
          'Burn: caller does not have coupon:burn permission'
        );
      });
    });
  });

  contract('VerificationCoupon', (accounts) => {
    const deployerAccount = accounts[0];
    const issuer = accounts[2];
    const primaryAccount = issuer;
    const permissionsAccount = primaryAccount;
    const operatorAccount = accounts[3];

    const mockMetadataContractAddress = accounts[4];
    const quantity = 1;
    let permissionsContractInstance;
    let verificationCouponInstance;

    before(async () => {
      ({ permissionsContractInstance, verificationCouponInstance } =
        await setupContracts(mockMetadataContractAddress, primaryAccount));
      await permissionsContractInstance.addOperatorKey(
        primaryAccount,
        operatorAccount,
        { from: permissionsAccount }
      );
    });

    describe('Check contract owner rights', () => {
      it("Account don't have minter role", async () => {
        assert.notEqual(
          await verificationCouponInstance.hasRole(
            '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6',
            issuer
          ),
          'this account has minter rights'
        );
      });
      it('Add new minter', async () => {
        await verificationCouponInstance.grantRole(
          '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6',
          issuer,
          { from: deployerAccount }
        );
        assert.equal(
          await verificationCouponInstance.hasRole(
            '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6',
            issuer
          ),
          true,
          'Account dont have minter role'
        );
      });
      it('VNF burn token created by allowed account', async () => {
        await verificationCouponInstance.mint(
          issuer,
          expirationTime,
          quantity,
          traceId,
          ownerDid,
          { from: issuer }
        );
        await verificationCouponInstance.burn(
          0,
          traceId,
          caoDid,
          burnerDid,
          operatorAccount,
          { from: mockMetadataContractAddress }
        );
      });
    });
    describe('Token Info', () => {
      it('Token expired', async () => {
        await verificationCouponInstance.mint(
          issuer,
          expiredTime,
          quantity,
          traceId,
          ownerDid,
          { from: issuer }
        );
        assert.equal(
          await verificationCouponInstance.isExpired(1),
          true,
          'Token expired'
        );
      });
      it('Token not expired', async () => {
        await verificationCouponInstance.mint(
          issuer,
          expirationTime,
          quantity,
          traceId,
          ownerDid,
          { from: issuer }
        );
        assert.equal(
          await verificationCouponInstance.isExpired(2),
          false,
          'Token actual'
        );
      });
    });
  });

  contract('VerificationCoupon', (accounts) => {
    const deployerAccount = accounts[0];
    const primaryAccount = accounts[1];
    const permissionsAccount = primaryAccount;
    const operatorAccount = accounts[2];
    const mockMetadataContractAddress = accounts[3];
    let permissionsContractInstance;
    let verificationCouponInstance;

    before(async () => {
      ({ permissionsContractInstance, verificationCouponInstance } =
        await setupContracts(mockMetadataContractAddress, primaryAccount));
      await permissionsContractInstance.addOperatorKey(
        primaryAccount,
        operatorAccount,
        { from: permissionsAccount }
      );
    });
    describe('Mint new token bundle', () => {
      const quantity = 3;
      it('New token bundle minted', async () => {
        const result = await verificationCouponInstance.mint(
          primaryAccount,
          expirationTime,
          quantity,
          traceId,
          ownerDid,
          {
            from: deployerAccount,
          }
        );

        truffleAssert.eventEmitted(result, 'MintCouponBundle');
      });

      it('Burn token from new bundle by operator account', async () => {
        await verificationCouponInstance.burn(
          0,
          traceId,
          caoDid,
          burnerDid,
          operatorAccount,
          { from: mockMetadataContractAddress }
        );
        await verificationCouponInstance.burn(
          0,
          traceId,
          caoDid,
          burnerDid,
          operatorAccount,
          { from: mockMetadataContractAddress }
        );
        const tx = await verificationCouponInstance.burn(
          0,
          traceId,
          caoDid,
          burnerDid,
          operatorAccount,
          { from: mockMetadataContractAddress }
        );
        const { blockNumber } = tx.logs[1];
        const block = await web3.eth.getBlock(blockNumber);
        truffleAssert.eventEmitted(tx, 'BurnCoupon', {
          owner: primaryAccount,
          bundleId: web3.utils.toBN('0'),
          balance: web3.utils.toBN('0'),
          expirationTime: web3.utils.toBN(expirationTime),
          burnTime: web3.utils.toBN(block.timestamp),
        });
      });

      it('Throw an error if quantity is invalid', async () => {
        await truffleAssert.fails(
          verificationCouponInstance.mint(
            primaryAccount,
            expirationTime,
            0,
            traceId,
            ownerDid,
            {
              from: deployerAccount,
            }
          ),
          'Invalid quantity'
        );
      });
    });

    describe('Get tokens', () => {
      const quantity = 3;
      const secondCouponId = 1;
      it('Get the unused coupon for the account', async () => {
        await verificationCouponInstance.mint(
          primaryAccount,
          expirationTime,
          quantity,
          traceId,
          ownerDid,
          {
            from: deployerAccount,
          }
        );
        await verificationCouponInstance.mint(
          primaryAccount,
          expirationTime,
          quantity,
          traceId,
          ownerDid,
          {
            from: deployerAccount,
          }
        );
        const couponId = await verificationCouponInstance.getTokenId(
          operatorAccount
        );
        assert.equal(
          couponId.toNumber(),
          secondCouponId,
          'It is not the first unused coupon!'
        );
      });

      it('Get the next unused coupon when the previous was burned', async () => {
        await verificationCouponInstance.mint(
          primaryAccount,
          expirationTime,
          quantity,
          traceId,
          ownerDid,
          {
            from: deployerAccount,
          }
        );
        const tokenIds = [1, 1, 1, 2, 2, 2, 3, 3, 3];
        for (let i = 0; i < tokenIds.length; i += 1) {
          const couponId = await verificationCouponInstance.getTokenId(
            operatorAccount
          );
          await verificationCouponInstance.burn(
            couponId,
            traceId,
            caoDid,
            burnerDid,
            operatorAccount,
            {
              from: mockMetadataContractAddress,
            }
          );
          assert.equal(
            couponId.toNumber(),
            tokenIds[i],
            'It is not the first unused coupon!'
          );
        }
      });
      it('Mint and burn one token in loop', async () => {
        for (let i = 4; i < 9; i += 1) {
          await verificationCouponInstance.mint(
            primaryAccount,
            expirationTime,
            1,
            traceId,
            ownerDid,
            {
              from: deployerAccount,
            }
          );
          const couponId = await verificationCouponInstance.getTokenId(
            operatorAccount
          );
          await verificationCouponInstance.burn(
            couponId,
            traceId,
            caoDid,
            burnerDid,
            operatorAccount,
            {
              from: mockMetadataContractAddress,
            }
          );
          assert.equal(
            couponId.toNumber(),
            i,
            'It is not the first unused coupon!'
          );
        }
      });

      it('Mint and burn one by one and ignore expired minting', async () => {
        const tokenIds = [9, 11, 13];

        for (let i = 0; i < 3; i += 1) {
          await verificationCouponInstance.mint(
            primaryAccount,
            expirationTime,
            1,
            traceId,
            ownerDid,
            {
              from: deployerAccount,
            }
          );
          await verificationCouponInstance.mint(
            primaryAccount,
            expiredTime,
            1,
            traceId,
            ownerDid,
            {
              from: deployerAccount,
            }
          );
          const couponId = await verificationCouponInstance.getTokenId(
            operatorAccount
          );
          await verificationCouponInstance.burn(
            couponId,
            traceId,
            caoDid,
            burnerDid,
            operatorAccount,
            {
              from: mockMetadataContractAddress,
            }
          );
          assert.equal(
            couponId.toNumber(),
            tokenIds[i],
            'It is not the first unused coupon!'
          );
        }
      });

      it('Throw an error if the account without tokens', async () => {
        await truffleAssert.fails(
          verificationCouponInstance.getTokenId(operatorAccount),
          'No available tokens'
        );
      });

      it('Error if primary tries to retrieve its own tokens, not as an operator', async () => {
        await truffleAssert.fails(
          verificationCouponInstance.getTokenId(primaryAccount),
          'Permissions: operator not pointing to a primary'
        );
      });
    });
  });

  contract('VerificationCoupon', (accounts) => {
    const deployerAccount = accounts[0];
    const primaryAccount = accounts[1];
    const permissionsAccount = primaryAccount;
    const operatorAccount = accounts[2];
    const mockMetadataContractAddress = accounts[3];
    let permissionsContractInstance;
    let verificationCouponInstance;

    before(async () => {
      ({ permissionsContractInstance, verificationCouponInstance } =
        await setupContracts(mockMetadataContractAddress, primaryAccount));
      await permissionsContractInstance.addOperatorKey(
        primaryAccount,
        operatorAccount,
        { from: permissionsAccount }
      );
    });
    describe('Burn expired tokens', () => {
      const quantity = 100;
      const firstCouponId = 2;
      it('Burn two expired bundles', async () => {
        await verificationCouponInstance.mint(
          primaryAccount,
          expiredTime,
          quantity,
          traceId,
          ownerDid,
          {
            from: deployerAccount,
          }
        );
        await verificationCouponInstance.mint(
          primaryAccount,
          expiredTime,
          quantity,
          traceId,
          ownerDid,
          {
            from: deployerAccount,
          }
        );
        await verificationCouponInstance.mint(
          primaryAccount,
          expirationTime,
          quantity,
          traceId,
          ownerDid,
          {
            from: deployerAccount,
          }
        );
        const couponId = await verificationCouponInstance.getTokenId(
          operatorAccount
        );

        assert.equal(
          couponId.toNumber(),
          firstCouponId,
          'It is not the first unused coupon!'
        );
        assert.equal(
          await verificationCouponInstance.balanceOf(primaryAccount, 0),
          100
        );
        assert.equal(
          await verificationCouponInstance.balanceOf(primaryAccount, 1),
          100
        );
        await verificationCouponInstance.burn(
          firstCouponId,
          traceId,
          caoDid,
          burnerDid,
          operatorAccount,
          {
            from: mockMetadataContractAddress,
          }
        );
        assert.equal(
          await verificationCouponInstance.balanceOf(primaryAccount, 0),
          0
        );
        assert.equal(
          await verificationCouponInstance.balanceOf(primaryAccount, 1),
          0
        );
      });
    });
  });

  describe('getTokenId handle token found, but all tokens are expired', () => {
    contract('VerificationCoupon', (accounts) => {
      const deployerAccount = accounts[0];
      const primaryAccount = accounts[1];
      const permissionsAccount = primaryAccount;
      const operatorAccount = accounts[2];
      const mockMetadataContractAddress = accounts[3];
      let permissionsContractInstance;
      let verificationCouponInstance;

      before(async () => {
        ({ permissionsContractInstance, verificationCouponInstance } =
          await setupContracts(mockMetadataContractAddress, primaryAccount));
        await permissionsContractInstance.addOperatorKey(
          primaryAccount,
          operatorAccount,
          { from: permissionsAccount }
        );
      });
      it('should error when no unexpired tokens exist', async () => {
        const quantity = 1;
        await verificationCouponInstance.mint(
          primaryAccount,
          expiredTime,
          quantity,
          traceId,
          ownerDid,
          {
            from: deployerAccount,
          }
        );
        await truffleAssert.fails(
          verificationCouponInstance.getTokenId(operatorAccount),
          'No available tokens'
        );
      });
    });
  });
});
