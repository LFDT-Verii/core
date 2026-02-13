const assert = require('node:assert/strict');
const { ethers } = require('hardhat');
const { Wallet, AbiCoder, keccak256 } = require('ethers');
const { signAddress } = require('@verii/blockchain-functions');
const { execute, expectRevert, findEvent } = require('../../test-utils');

const setupContracts = async ({ primary, deployerSigner }) => {
  const Permissions = await ethers.getContractFactory('Permissions', deployerSigner);
  const permissionsContractInstance = await Permissions.deploy();
  await permissionsContractInstance.waitForDeployment();
  await execute(permissionsContractInstance.initialize());

  const RevocationRegistry = await ethers.getContractFactory(
    'RevocationRegistry',
    deployerSigner,
  );
  const revocationRegistryInstance = await RevocationRegistry.deploy();
  await revocationRegistryInstance.waitForDeployment();
  await execute(revocationRegistryInstance.initialize());
  await execute(
    revocationRegistryInstance.setPermissionsAddress(
      await permissionsContractInstance.getAddress(),
    ),
  );

  await execute(permissionsContractInstance.addPrimary(primary, primary, primary));
  await execute(
    permissionsContractInstance.addAddressScope(primary, 'transactions:write'),
  );

  return { revocationRegistryInstance, permissionsContractInstance };
};

describe('Revocation Registry', () => {
  let signers;
  let deployerSigner;
  let primarySigner;
  let operatorSigner;
  let randomTxSigner;

  let primaryAccount;
  let operatorAccount;
  let randomTxAccount;
  let randomNonTxAccount;

  const operatorWallet = new Wallet(
    '0x33f46d353f191f8067dc7d256e9d9ee7a2a3300649ff7c70fe1cd7e5d5237da5',
  );
  const impersonatorWallet = new Wallet(
    '0x4c30c0c2c34f080b4d7dd150f7afa66c3fe000fb037592516f9b85c031e4b6b3',
  );

  before(async () => {
    signers = await ethers.getSigners();
    [
      deployerSigner,
      primarySigner,
      operatorSigner,
      randomTxSigner,
    ] = signers;

    primaryAccount = await primarySigner.getAddress();
    operatorAccount = await operatorSigner.getAddress();
    randomTxAccount = await randomTxSigner.getAddress();
    randomNonTxAccount = await signers[4].getAddress();

  });

  describe('Set permission address', () => {
    let permissionsInstance;

    before(async () => {
      const contracts = await setupContracts({
        primary: primaryAccount,
        deployerSigner,
      });
      permissionsInstance = contracts.permissionsContractInstance;
    });

    it('Should allow setup permission if there is no address', async () => {
      const RevocationRegistry = await ethers.getContractFactory('RevocationRegistry');
      const revocationRegistryInstance = await RevocationRegistry.deploy();
      await revocationRegistryInstance.waitForDeployment();
      await execute(revocationRegistryInstance.initialize());
      const permissionsAddress = await permissionsInstance.getAddress();

      await execute(
        revocationRegistryInstance
          .connect(operatorSigner)
          .setPermissionsAddress(permissionsAddress),
      );

      await expectRevert(
        () =>
          execute(
            revocationRegistryInstance
              .connect(operatorSigner)
              .setPermissionsAddress(permissionsAddress),
          ),
        'Permissions: caller is not VNF',
      );
    });

    it('Should not allow setup permission if caller is not VNF', async () => {
      const RevocationRegistry = await ethers.getContractFactory('RevocationRegistry');
      const revocationRegistryInstance = await RevocationRegistry.deploy();
      await revocationRegistryInstance.waitForDeployment();
      await execute(revocationRegistryInstance.initialize());
      const permissionsAddress = await permissionsInstance.getAddress();

      await execute(
        revocationRegistryInstance
          .connect(primarySigner)
          .setPermissionsAddress(permissionsAddress),
      );

      await expectRevert(
        () =>
          execute(
            revocationRegistryInstance
              .connect(operatorSigner)
              .setPermissionsAddress(permissionsAddress),
          ),
        'Permissions: caller is not VNF',
      );
    });

    it('Should allow setup permission if caller is VNF', async () => {
      const RevocationRegistry = await ethers.getContractFactory('RevocationRegistry');
      const revocationRegistryInstance = await RevocationRegistry.deploy();
      await revocationRegistryInstance.waitForDeployment();
      await execute(revocationRegistryInstance.initialize());
      const permissionsAddress = await permissionsInstance.getAddress();

      await execute(
        revocationRegistryInstance
          .connect(primarySigner)
          .setPermissionsAddress(permissionsAddress),
      );
      assert.equal(
        await revocationRegistryInstance.getPermissionsAddress(),
        permissionsAddress,
      );

      const secondPermissionAccount = ethers.Wallet.createRandom();
      await execute(
        revocationRegistryInstance.setPermissionsAddress(secondPermissionAccount.address),
      );
      assert.equal(
        await revocationRegistryInstance.getPermissionsAddress(),
        secondPermissionAccount.address,
      );
    });
  });

  describe('Revocation Registry functionality', () => {
    let revocationRegistryInstance;
    let permissionsContractInstance;

    before(async () => {
      const contracts = await setupContracts({
        primary: primaryAccount,
        deployerSigner,
      });
      revocationRegistryInstance = contracts.revocationRegistryInstance;
      permissionsContractInstance = contracts.permissionsContractInstance;
      await execute(
        permissionsContractInstance
          .connect(primarySigner)
          .addOperatorKey(primaryAccount, operatorAccount),
      );
    });

    it('Should not add Revocation without a wallet', async () => {
      await expectRevert(
        () =>
          execute(
            revocationRegistryInstance
              .connect(operatorSigner)
              .addRevocationList(3, 'traceId', 'caoDid'),
          ),
        'wallet not in registry',
      );
    });

    it('Should fail add wallet if not operator', async () => {
      await expectRevert(
        () =>
          execute(
            revocationRegistryInstance
              .connect(primarySigner)
              .addWallet('traceId', 'caoDid'),
          ),
        'Permissions: operator not pointing to a primary',
      );
    });

    it('Should add wallet if operator', async () => {
      const receipt = await execute(
        revocationRegistryInstance
          .connect(operatorSigner)
          .addWallet('traceId', 'caoDid'),
      );

      const event = findEvent(receipt, revocationRegistryInstance, 'WalletAdded');
      assert.ok(event, 'WalletAdded event was not emitted');
      assert.equal(event.args.traceId, 'traceId');
      assert.equal(event.args.caoDid, 'caoDid');
      assert.equal(event.args.wallet, primaryAccount);
    });

    it('Should add Revocation list if operator', async () => {
      const receipt = await execute(
        revocationRegistryInstance
          .connect(operatorSigner)
          .addRevocationList(1, 'traceId', 'caoDid'),
      );

      const event = findEvent(receipt, revocationRegistryInstance, 'RevocationListCreate');
      assert.ok(event, 'RevocationListCreate event was not emitted');
      assert.equal(event.args.wallet, primaryAccount);
      assert.equal(event.args.listId, 1n);
      assert.equal(event.args.traceId, 'traceId');
      assert.equal(event.args.caoDid, 'caoDid');

      const status = await revocationRegistryInstance.getRevokedStatus(
        primaryAccount,
        1,
        1,
      );
      assert.equal(status, 0n);

      const total = await revocationRegistryInstance
        .connect(operatorSigner)
        .getRevocationListCount();
      assert.equal(total, 1n);

      assert.equal(
        await revocationRegistryInstance.isListExist(primaryAccount, 1),
        true,
      );
    });

    it('Should not add Revocation list with same id if operator', async () => {
      await execute(
        revocationRegistryInstance
          .connect(operatorSigner)
          .addRevocationList(2, 'traceId', 'caoDid'),
      );

      await expectRevert(
        () =>
          execute(
            revocationRegistryInstance
              .connect(operatorSigner)
              .addRevocationList(2, 'traceId', 'caoDid'),
          ),
        'revocation list with given id already exist',
      );
    });

    describe('Set revoked status', () => {
      before(async () => {
        const contracts = await setupContracts({
          primary: primaryAccount,
          deployerSigner,
        });
        revocationRegistryInstance = contracts.revocationRegistryInstance;
        permissionsContractInstance = contracts.permissionsContractInstance;
        await execute(
          permissionsContractInstance
            .connect(primarySigner)
            .addOperatorKey(primaryAccount, operatorAccount),
        );
      });

      it('Should fail if wallet not pointing to a primary', async () => {
        await expectRevert(
          () =>
            execute(
              revocationRegistryInstance.setRevokedStatus(1, 2, 'traceId', 'caoDid'),
            ),
          'Permissions: operator not pointing to a primary',
        );
      });

      it('Should fail if list index is out of bounds', async () => {
        await execute(
          revocationRegistryInstance
            .connect(operatorSigner)
            .addWallet('traceId', 'caoDid'),
        );

        await expectRevert(
          () =>
            execute(
              revocationRegistryInstance
                .connect(operatorSigner)
                .setRevokedStatus(1, 10242, 'traceId', 'caoDid'),
            ),
          'list index out of bound',
        );
      });

      it('setRevokedStatus should properly revoke credential status', async () => {
        await execute(
          revocationRegistryInstance
            .connect(operatorSigner)
            .addRevocationList(1, 'traceId', 'caoDid'),
        );

        const receipt = await execute(
          revocationRegistryInstance
            .connect(operatorSigner)
            .setRevokedStatus(1, 2, 'traceId', 'caoDid'),
        );

        const event = findEvent(receipt, revocationRegistryInstance, 'RevokedStatusUpdate');
        assert.ok(event, 'RevokedStatusUpdate event was not emitted');
        assert.equal(event.args.owner, primaryAccount);
        assert.equal(event.args.listId, 1n);
        assert.equal(event.args.index, 2n);
        assert.equal(event.args.traceId, 'traceId');
        assert.equal(event.args.caoDid, 'caoDid');

        const status = await revocationRegistryInstance.getRevokedStatus(
          primaryAccount,
          1,
          2,
        );
        assert.equal(status, 1n);

        assert.equal(
          await revocationRegistryInstance
            .connect(operatorSigner)
            .getRevocationListCount(),
          1n,
        );
      });

      it('Should fail if list with list id does not exist', async () => {
        await expectRevert(
          () =>
            execute(
              revocationRegistryInstance
                .connect(operatorSigner)
                .setRevokedStatus(11, 2, 'traceId', 'caoDid'),
            ),
          'revocation list with given id does not exist',
        );
      });
    });

    describe('Get revoked status', () => {
      it('Should have correct status number', async () => {
        const status = await revocationRegistryInstance.getRevokedStatus(
          primaryAccount,
          1,
          2,
        );

        assert.equal(status, 1n);
      });

      it('Should fail if list index is out of bounds', async () => {
        await expectRevert(
          () =>
            revocationRegistryInstance.getRevokedStatus(primaryAccount, 1, 10242),
          'list index out of bound',
        );
      });

      it('Should fail if list with list id does not exist', async () => {
        await expectRevert(
          () => revocationRegistryInstance.getRevokedStatus(primaryAccount, 11, 2),
          'revocation list with given id does not exist',
        );
      });

      it('Should fail if wallet does not exist', async () => {
        await expectRevert(
          () =>
            revocationRegistryInstance.getRevokedStatus(
              randomTxAccount,
              11,
              2,
            ),
          'wallet not in registry',
        );
      });
    });

    describe('Get revocation list count', () => {
      before(async () => {
        const contracts = await setupContracts({
          primary: primaryAccount,
          deployerSigner,
        });
        revocationRegistryInstance = contracts.revocationRegistryInstance;
        permissionsContractInstance = contracts.permissionsContractInstance;
        await execute(
          permissionsContractInstance
            .connect(primarySigner)
            .addOperatorKey(primaryAccount, operatorAccount),
        );
      });

      it('Should fail if wallet not in the registry', async () => {
        await expectRevert(
          () =>
            revocationRegistryInstance
              .connect(operatorSigner)
              .getRevocationListCount(),
          'wallet not in registry',
        );
      });

      it('Should get correct numbers', async () => {
        await execute(
          revocationRegistryInstance
            .connect(operatorSigner)
            .addWallet('traceId', 'caoDid'),
        );
        const total = await revocationRegistryInstance
          .connect(operatorSigner)
          .getRevocationListCount();

        assert.equal(total, 0n);

        await execute(
          revocationRegistryInstance
            .connect(operatorSigner)
            .addRevocationList(1, 'traceId', 'caoDid'),
        );

        assert.equal(
          await revocationRegistryInstance
            .connect(operatorSigner)
            .getRevocationListCount(),
          1n,
        );

        await execute(
          revocationRegistryInstance
            .connect(operatorSigner)
            .addRevocationList(2, 'traceId2', 'caoDid2'),
        );

        assert.equal(
          await revocationRegistryInstance
            .connect(operatorSigner)
            .getRevocationListCount(),
          2n,
        );
      });
    });
  });

  describe('Revocation Registry signed methods functionality', () => {
    let revocationRegistryInstance;
    let permissionsContractInstance;

    before(async () => {
      const contracts = await setupContracts({
        primary: primaryAccount,
        deployerSigner,
      });
      revocationRegistryInstance = contracts.revocationRegistryInstance;
      permissionsContractInstance = contracts.permissionsContractInstance;

      await execute(
        permissionsContractInstance
          .connect(primarySigner)
          .addOperatorKey(primaryAccount, operatorAccount),
      );

      // For parity with legacy ganache deterministic key behavior.
      await execute(
        permissionsContractInstance
          .connect(primarySigner)
          .addOperatorKey(primaryAccount, operatorWallet.address),
      );
    });

    it('addWalletSigned should fail with empty signature', async () => {
      await expectRevert(
        () =>
          execute(
            revocationRegistryInstance
              .connect(randomTxSigner)
              .addWalletSigned('traceId', 'caoDid', ''),
          ),
        'invalid BytesLike value',
      );
    });

    it('addWalletSigned should fail with bad signature length', async () => {
      await expectRevert(
        () =>
          execute(
            revocationRegistryInstance
              .connect(randomTxSigner)
              .addWalletSigned(
                'traceId',
                'caoDid',
                '0x90c082e8de5b2f45aab09bcf5d00e27a19d87a2de31536e6c',
              ),
          ),
        ['invalid signature length', 'invalid BytesLike value'],
      );
    });

    it('addWalletSigned should fail with arbitrary signature', async () => {
      await expectRevert(
        () =>
          execute(
            revocationRegistryInstance
              .connect(randomTxSigner)
              .addWalletSigned(
                'traceId',
                'caoDid',
                '0x90c082e8de5b2f45aab09bcf5d00e27a19d87a2de31536e6cda19da761c0f6845aea70eb9946fe47a4549b1ff205e098994a5bd2db772d9bfc407142e97081e11c',
              ),
          ),
        'Permissions: operator not pointing to a primary',
      );
    });

    it('addWalletSigned should fail when wrong address payload is signed', async () => {
      const signature = signAddress({
        address: randomNonTxAccount,
        signerWallet: operatorWallet,
      });
      await expectRevert(
        () =>
          execute(
            revocationRegistryInstance
              .connect(randomTxSigner)
              .addWalletSigned('traceId', 'caoDid', signature),
          ),
        'Permissions: operator not pointing to a primary',
      );
    });

    it('addWalletSigned should fail when wrong payload type is signed', async () => {
      const encodedArgs = AbiCoder.defaultAbiCoder().encode(['uint256'], [10]);
      const hash = keccak256(encodedArgs);
      const signature = operatorWallet.signingKey.sign(hash).serialized;
      await expectRevert(
        () =>
          execute(
            revocationRegistryInstance
              .connect(randomTxSigner)
              .addWalletSigned('traceId', 'caoDid', signature),
          ),
        'Permissions: operator not pointing to a primary',
      );
    });

    it('addWalletSigned should fail when not signed by the operator', async () => {
      const signature = signAddress({
        address: randomNonTxAccount,
        signerWallet: impersonatorWallet,
      });
      await expectRevert(
        () =>
          execute(
            revocationRegistryInstance
              .connect(randomTxSigner)
              .addWalletSigned('traceId', 'caoDid', signature),
          ),
        'Permissions: operator not pointing to a primary',
      );
    });

    it('addRevocationListSigned should fail without a wallet', async () => {
      const signature = signAddress({
        address: randomTxAccount,
        signerWallet: operatorWallet,
      });
      await expectRevert(
        () =>
          execute(
            revocationRegistryInstance
              .connect(randomTxSigner)
              .addRevocationListSigned(3, 'traceId', 'caoDid', signature),
          ),
        'wallet not in registry',
      );
    });

    it('addWalletSigned should succeed when signed by the operator', async () => {
      const signature = signAddress({
        address: randomTxAccount,
        signerWallet: operatorWallet,
      });
      const receipt = await execute(
        revocationRegistryInstance
          .connect(randomTxSigner)
          .addWalletSigned('traceId', 'caoDid', signature),
      );

      const event = findEvent(receipt, revocationRegistryInstance, 'WalletAdded');
      assert.ok(event, 'WalletAdded event was not emitted');
      assert.equal(event.args.traceId, 'traceId');
      assert.equal(event.args.caoDid, 'caoDid');
      assert.equal(event.args.wallet, primaryAccount);
    });

    it('addRevocationListSigned should succeed', async () => {
      const signature = signAddress({
        address: randomTxAccount,
        signerWallet: operatorWallet,
      });
      const receipt = await execute(
        revocationRegistryInstance
          .connect(randomTxSigner)
          .addRevocationListSigned(1, 'traceId', 'caoDid', signature),
      );

      const event = findEvent(receipt, revocationRegistryInstance, 'RevocationListCreate');
      assert.ok(event, 'RevocationListCreate event was not emitted');
      assert.equal(event.args.wallet, primaryAccount);
      assert.equal(event.args.listId, 1n);
      assert.equal(event.args.traceId, 'traceId');
      assert.equal(event.args.caoDid, 'caoDid');

      const status = await revocationRegistryInstance.getRevokedStatus(
        primaryAccount,
        1,
        1,
      );
      assert.equal(status, 0n);

      const total = await revocationRegistryInstance
        .connect(operatorSigner)
        .getRevocationListCount();
      assert.equal(total, 1n);

      assert.equal(
        await revocationRegistryInstance.isListExist(primaryAccount, 1),
        true,
      );
    });

    it('addRevocationListSigned should fail when signed by the operator but has same id', async () => {
      const signature = signAddress({
        address: randomTxAccount,
        signerWallet: operatorWallet,
      });
      await expectRevert(
        () =>
          execute(
            revocationRegistryInstance
              .connect(randomTxSigner)
              .addRevocationListSigned(1, 'traceId', 'caoDid', signature),
          ),
        'revocation list with given id already exist',
      );
    });

    it('setRevokedStatusSigned should fail with empty signature', async () => {
      await expectRevert(
        () =>
          execute(
            revocationRegistryInstance
              .connect(randomTxSigner)
              .setRevokedStatusSigned(1, 2, 'traceId', 'caoDid', ''),
          ),
        'invalid BytesLike value',
      );
    });

    it('setRevokedStatusSigned should fail with bad signature length', async () => {
      await expectRevert(
        () =>
          execute(
            revocationRegistryInstance
              .connect(randomTxSigner)
              .setRevokedStatusSigned(
                1,
                2,
                'traceId',
                'caoDid',
                '0x90c082e8de5b2f45aab09bcf5d00e27a19d87a2de31536e6c',
              ),
          ),
        ['invalid signature length', 'invalid BytesLike value'],
      );
    });

    it('setRevokedStatusSigned should fail with arbitrary signature', async () => {
      await expectRevert(
        () =>
          execute(
            revocationRegistryInstance
              .connect(randomTxSigner)
              .setRevokedStatusSigned(
                1,
                2,
                'traceId',
                'caoDid',
                '0x90c082e8de5b2f45aab09bcf5d00e27a19d87a2de31536e6cda19da761c0f6845aea70eb9946fe47a4549b1ff205e098994a5bd2db772d9bfc407142e97081e11c',
              ),
          ),
        'Permissions: operator not pointing to a primary',
      );
    });

    it('setRevokedStatusSigned should fail when wrong address payload is signed', async () => {
      const signature = signAddress({
        address: randomNonTxAccount,
        signerWallet: operatorWallet,
      });
      await expectRevert(
        () =>
          execute(
            revocationRegistryInstance
              .connect(randomTxSigner)
              .setRevokedStatusSigned(1, 2, 'traceId', 'caoDid', signature),
          ),
        'Permissions: operator not pointing to a primary',
      );
    });

    it('setRevokedStatusSigned should fail when wrong payload type is signed', async () => {
      const encodedArgs = AbiCoder.defaultAbiCoder().encode(['uint256'], [10]);
      const hash = keccak256(encodedArgs);
      const signature = operatorWallet.signingKey.sign(hash).serialized;
      await expectRevert(
        () =>
          execute(
            revocationRegistryInstance
              .connect(randomTxSigner)
              .setRevokedStatusSigned(1, 2, 'traceId', 'caoDid', signature),
          ),
        'Permissions: operator not pointing to a primary',
      );
    });

    it('setRevokedStatusSigned should fail when not signed by the operator', async () => {
      const signature = signAddress({
        address: randomNonTxAccount,
        signerWallet: impersonatorWallet,
      });
      await expectRevert(
        () =>
          execute(
            revocationRegistryInstance
              .connect(randomTxSigner)
              .setRevokedStatusSigned(1, 2, 'traceId', 'caoDid', signature),
          ),
        'Permissions: operator not pointing to a primary',
      );
    });

    it('setRevokedStatusSigned should properly revoke credential status', async () => {
      const signature = signAddress({
        address: randomTxAccount,
        signerWallet: operatorWallet,
      });
      const receipt = await execute(
        revocationRegistryInstance
          .connect(randomTxSigner)
          .setRevokedStatusSigned(1, 2, 'traceId', 'caoDid', signature),
      );

      const event = findEvent(receipt, revocationRegistryInstance, 'RevokedStatusUpdate');
      assert.ok(event, 'RevokedStatusUpdate event was not emitted');
      assert.equal(event.args.owner, primaryAccount);
      assert.equal(event.args.listId, 1n);
      assert.equal(event.args.index, 2n);
      assert.equal(event.args.traceId, 'traceId');
      assert.equal(event.args.caoDid, 'caoDid');

      const status = await revocationRegistryInstance.getRevokedStatus(
        primaryAccount,
        1,
        2,
      );
      assert.equal(status, 1n);

      assert.equal(
        await revocationRegistryInstance
          .connect(operatorSigner)
          .getRevocationListCount(),
        1n,
      );
    });

    it('setRevokedStatusSigned should fail when listId Does not exist', async () => {
      const signature = signAddress({
        address: randomTxAccount,
        signerWallet: operatorWallet,
      });
      await expectRevert(
        () =>
          execute(
            revocationRegistryInstance
              .connect(randomTxSigner)
              .setRevokedStatusSigned(2, 0, 'traceId', 'caoDid', signature),
          ),
        'revocation list with given id does not exist',
      );
    });
  });
});
