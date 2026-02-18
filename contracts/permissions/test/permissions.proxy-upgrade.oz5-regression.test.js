const assert = require('node:assert/strict');
const { ethers, upgrades } = require('hardhat');
const { execute, expectRevert } = require('../../test-utils');

describe('Permissions Proxy Upgrade OZ5 Regression', () => {
  it('preserves VNF, scopes and operator mapping across proxy upgrade', async () => {
    const [deployerSigner, newVnfSigner, primarySigner, permissioningSigner, rotationSigner, operatorSigner] =
      await ethers.getSigners();

    const deployer = await deployerSigner.getAddress();
    const newVnf = await newVnfSigner.getAddress();
    const primary = await primarySigner.getAddress();
    const permissioning = await permissioningSigner.getAddress();
    const rotation = await rotationSigner.getAddress();
    const operator = await operatorSigner.getAddress();

    const Permissions = await ethers.getContractFactory('Permissions', deployerSigner);
    const permissions = await upgrades.deployProxy(Permissions, [], {
      initializer: 'initialize',
      kind: 'transparent',
    });
    await permissions.waitForDeployment();

    await execute(permissions.addPrimary(primary, permissioning, rotation));
    await execute(permissions.addAddressScope(primary, 'transactions:write'));
    await execute(
      permissions
        .connect(permissioningSigner)
        .addOperatorKey(primary, operator),
    );
    await execute(permissions.rotateVNF(newVnf));

    const upgradedPermissions = await upgrades.upgradeProxy(
      await permissions.getAddress(),
      Permissions,
      { kind: 'transparent' },
    );

    assert.equal(await upgradedPermissions.getVNF(), newVnf);
    assert.equal(await upgradedPermissions.lookupPrimary(operator), primary);
    assert.equal(
      await upgradedPermissions.checkAddressScope(primary, 'transactions:write'),
      true,
    );

    // Ensure previous VNF no longer has admin rights.
    await expectRevert(
      () => execute(upgradedPermissions.connect(deployerSigner).rotateVNF(deployer)),
      'Permissions: caller is not VNF',
    );
  });
});
