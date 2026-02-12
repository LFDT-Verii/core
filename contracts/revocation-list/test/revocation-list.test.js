const assert = require('node:assert/strict');
const { ethers } = require('hardhat');
const { signAddress } = require('@verii/blockchain-functions');

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

const deployRevocationRegistry = async (permissionsAddress) => {
  const RevocationRegistry = await ethers.getContractFactory('RevocationRegistry');
  const registry = await RevocationRegistry.deploy();
  await registry.waitForDeployment();
  await execute(registry.initialize());
  await execute(registry.setPermissionsAddress(permissionsAddress));
  return registry;
};

describe('Revocation Registry', () => {
  let primarySigner;
  let operatorSigner;
  let randomSigner;
  let permissions;
  let registry;
  let primary;
  let operator;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    [, primarySigner, operatorSigner, randomSigner] = signers;

    primary = await primarySigner.getAddress();
    operator = await operatorSigner.getAddress();

    permissions = await deployPermissions();
    registry = await deployRevocationRegistry(await permissions.getAddress());

    await execute(permissions.addPrimary(primary, primary, primary));
    await execute(permissions.addAddressScope(primary, 'transactions:write'));
    await execute(permissions.connect(primarySigner).addOperatorKey(primary, operator));
  });

  it('should enforce setPermissionsAddress ownership after initial set', async () => {
    const RevocationRegistry = await ethers.getContractFactory('RevocationRegistry');
    const secondaryRegistry = await RevocationRegistry.deploy();
    await secondaryRegistry.waitForDeployment();
    await execute(secondaryRegistry.initialize());

    const permissionsAddress = await permissions.getAddress();
    await execute(
      secondaryRegistry
        .connect(randomSigner)
        .setPermissionsAddress(permissionsAddress),
    );

    await expectRevert(
      () =>
        execute(
          secondaryRegistry
            .connect(randomSigner)
            .setPermissionsAddress(permissionsAddress),
        ),
      'Permissions: caller is not VNF',
    );
  });

  it('should add wallet/list and update revoked status via operator', async () => {
    await expectRevert(
      () =>
        execute(
          registry
            .connect(operatorSigner)
            .addRevocationList(1, 'traceId', 'caoDid'),
        ),
      'wallet not in registry',
    );

    await execute(registry.connect(operatorSigner).addWallet('traceId', 'caoDid'));
    assert.equal(await registry.isWalletExist(primary), true);

    await execute(
      registry.connect(operatorSigner).addRevocationList(1, 'traceId', 'caoDid'),
    );
    assert.equal(await registry.isListExist(primary, 1), true);
    assert.equal(
      await registry.connect(operatorSigner).getRevocationListCount(),
      1n,
    );

    assert.equal(await registry.getRevokedStatus(primary, 1, 1), 0n);
    await execute(
      registry
        .connect(operatorSigner)
        .setRevokedStatus(1, 1, 'traceId', 'caoDid'),
    );
    assert.equal(await registry.getRevokedStatus(primary, 1, 1), 1n);
  });

  it('should reject non-operator wallet/list operations', async () => {
    await expectRevert(
      () => execute(registry.connect(primarySigner).addWallet('traceId', 'caoDid')),
      'Permissions: operator not pointing to a primary',
    );
  });

  it('should support signed operator flows', async () => {
    const randomCaller = await randomSigner.getAddress();
    const operatorWallet = ethers.Wallet.createRandom();

    await execute(
      permissions
        .connect(primarySigner)
        .addOperatorKey(primary, operatorWallet.address),
    );

    const walletSignature = signAddress({
      address: randomCaller,
      signerWallet: operatorWallet,
    });

    await execute(
      registry
        .connect(randomSigner)
        .addWalletSigned('traceId', 'caoDid', walletSignature),
    );
    assert.equal(await registry.isWalletExist(primary), true);
  });
});
