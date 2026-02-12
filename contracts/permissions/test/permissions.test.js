const assert = require('node:assert/strict');
const { ethers } = require('hardhat');

const execute = async (txPromise) => {
  const tx = await txPromise;
  await tx.wait();
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

describe('Permissions Contract', () => {
  let signers;
  let vnfSigner;
  let primarySigner;
  let permissioningSigner;
  let rotationSigner;
  let operatorSigner;
  let nextOperatorSigner;
  let outsiderSigner;
  let permissions;

  beforeEach(async () => {
    signers = await ethers.getSigners();
    [
      vnfSigner,
      primarySigner,
      permissioningSigner,
      rotationSigner,
      operatorSigner,
      nextOperatorSigner,
      outsiderSigner,
    ] = signers;
    permissions = await deployPermissions();
  });

  it('initializes VNF as deployer and rotates only from VNF', async () => {
    const vnf = await vnfSigner.getAddress();
    const outsider = await outsiderSigner.getAddress();

    assert.equal(await permissions.getVNF(), vnf);

    await expectRevert(
      () => execute(permissions.connect(outsiderSigner).rotateVNF(outsider)),
      'Permissions: caller is not VNF',
    );

    await execute(permissions.rotateVNF(outsider));
    assert.equal(await permissions.getVNF(), outsider);
  });

  it('manages address scopes from VNF only', async () => {
    const addr = await outsiderSigner.getAddress();

    await expectRevert(
      () =>
        execute(
          permissions
            .connect(outsiderSigner)
            .addAddressScope(addr, 'transactions:write'),
        ),
      'Permissions: caller is not VNF',
    );

    await execute(permissions.addAddressScope(addr, 'transactions:write'));
    assert.equal(
      await permissions.checkAddressScope(addr, 'transactions:write'),
      true,
    );

    await execute(
      permissions.updateAddressScopes(addr, ['credential:issue'], ['transactions:write']),
    );
    assert.equal(
      await permissions.checkAddressScope(addr, 'transactions:write'),
      false,
    );
    assert.equal(await permissions.checkAddressScope(addr, 'credential:issue'), true);
  });

  it('creates primary and manages operators via permissioning key', async () => {
    const primary = await primarySigner.getAddress();
    const permissioning = await permissioningSigner.getAddress();
    const rotation = await rotationSigner.getAddress();
    const operator = await operatorSigner.getAddress();
    const nextOperator = await nextOperatorSigner.getAddress();

    await expectRevert(
      () =>
        execute(
          permissions
            .connect(outsiderSigner)
            .addPrimary(primary, permissioning, rotation),
        ),
      'Permissions: caller is not VNF',
    );

    await execute(permissions.addPrimary(primary, permissioning, rotation));
    const primaries = await permissions.getPrimaries();
    assert.equal(primaries.length, 1);
    assert.equal(primaries[0], primary);

    await expectRevert(
      () =>
        execute(
          permissions.connect(outsiderSigner).addOperatorKey(primary, operator),
        ),
      'Permissions: caller is not permissioning key',
    );

    await execute(
      permissions.connect(permissioningSigner).addOperatorKey(primary, operator),
    );
    assert.equal(await permissions.lookupPrimary(operator), primary);

    await execute(
      permissions
        .connect(permissioningSigner)
        .rotateOperatorKey(primary, nextOperator, operator),
    );
    assert.equal(await permissions.lookupPrimary(operator), ethers.ZeroAddress);
    assert.equal(await permissions.lookupPrimary(nextOperator), primary);
  });

  it('rotates permissioning only from rotation key', async () => {
    const primary = await primarySigner.getAddress();
    const permissioning = await permissioningSigner.getAddress();
    const rotation = await rotationSigner.getAddress();
    const nextPermissioning = await operatorSigner.getAddress();
    const nextRotation = await nextOperatorSigner.getAddress();

    await execute(permissions.addPrimary(primary, permissioning, rotation));

    await expectRevert(
      () =>
        execute(
          permissions
            .connect(outsiderSigner)
            .rotatePermissioning(primary, nextPermissioning, nextRotation),
        ),
      'Permissions: caller is not rotation key',
    );

    await execute(
      permissions
        .connect(rotationSigner)
        .rotatePermissioning(primary, nextPermissioning, nextRotation),
    );

    await execute(
      permissions.connect(operatorSigner).addOperatorKey(primary, await outsiderSigner.getAddress()),
    );
  });

  it('enforces operator checks for transactions:write and scopes', async () => {
    const primary = await primarySigner.getAddress();
    const permissioning = await permissioningSigner.getAddress();
    const rotation = await rotationSigner.getAddress();
    const operator = await operatorSigner.getAddress();

    await execute(permissions.addPrimary(primary, permissioning, rotation));
    await execute(
      permissions.connect(permissioningSigner).addOperatorKey(primary, operator),
    );

    await expectRevert(
      () => permissions.checkOperator(operator),
      'Permissions: primary of operator lacks transactions:write scope',
    );

    await execute(permissions.addAddressScope(primary, 'transactions:write'));
    await execute(permissions.addAddressScope(primary, 'credential:issue'));

    assert.equal(await permissions.checkOperator(operator), primary);
    assert.equal(
      await permissions.checkOperatorWithScope(operator, 'credential:issue'),
      primary,
    );
    assert.equal(
      await permissions.checkOperatorPermission(operator, 'credential:issue'),
      primary,
    );
  });
});
