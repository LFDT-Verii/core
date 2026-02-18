const assert = require('node:assert/strict');
const { ethers, upgrades } = require('hardhat');
const { execute } = require('../../test-utils');

describe('RevocationRegistry Proxy Upgrade OZ5 Regression', () => {
  it('preserves revocation data across proxy upgrade', async () => {
    const [deployerSigner, primarySigner, operatorSigner] = await ethers.getSigners();

    const primary = await primarySigner.getAddress();
    const operator = await operatorSigner.getAddress();

    const Permissions = await ethers.getContractFactory('Permissions', deployerSigner);
    const permissions = await upgrades.deployProxy(Permissions, [], {
      initializer: 'initialize',
      kind: 'transparent',
    });
    await permissions.waitForDeployment();

    const RevocationRegistry = await ethers.getContractFactory(
      'RevocationRegistry',
      deployerSigner,
    );
    const registry = await upgrades.deployProxy(RevocationRegistry, [], {
      initializer: 'initialize',
      kind: 'transparent',
    });
    await registry.waitForDeployment();

    await execute(registry.setPermissionsAddress(await permissions.getAddress()));
    await execute(permissions.addPrimary(primary, primary, primary));
    await execute(permissions.addAddressScope(primary, 'transactions:write'));
    await execute(permissions.connect(primarySigner).addOperatorKey(primary, operator));

    await execute(registry.connect(operatorSigner).addWallet('traceId', 'caoDid'));
    await execute(
      registry.connect(operatorSigner).addRevocationList(1, 'traceId', 'caoDid'),
    );
    await execute(
      registry
        .connect(operatorSigner)
        .setRevokedStatus(1, 10, 'traceId', 'caoDid'),
    );

    const upgradedRegistry = await upgrades.upgradeProxy(
      await registry.getAddress(),
      RevocationRegistry,
      { kind: 'transparent' },
    );

    const revoked = await upgradedRegistry.getRevokedStatus(primary, 1, 10);
    const totalLists = await upgradedRegistry
      .connect(operatorSigner)
      .getRevocationListCount();

    assert.equal(revoked.toString(), '1');
    assert.equal(totalLists.toString(), '1');
  });
});
