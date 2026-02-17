const assert = require('node:assert/strict');
const { ethers, upgrades } = require('hardhat');
const { execute } = require('../../test-utils');

describe('MetadataRegistry Proxy Upgrade OZ5 Regression', () => {
  it('preserves metadata entries across proxy upgrade', async () => {
    const [deployerSigner, primarySigner, operatorSigner] = await ethers.getSigners();

    const primary = await primarySigner.getAddress();
    const operator = await operatorSigner.getAddress();

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

    const MetadataRegistry = await ethers.getContractFactory(
      'MetadataRegistry',
      deployerSigner,
    );
    const metadata = await upgrades.deployProxy(
      MetadataRegistry,
      [await coupon.getAddress(), ['0x4ffb']],
      { initializer: 'initialize', kind: 'transparent' },
    );
    await metadata.waitForDeployment();

    const metadataAddress = await metadata.getAddress();
    await execute(permissions.addAddressScope(metadataAddress, 'coupon:burn'));
    await execute(metadata.setPermissionsAddress(await permissions.getAddress()));
    await execute(permissions.addPrimary(primary, primary, primary));
    await execute(permissions.addAddressScope(primary, 'transactions:write'));
    await execute(permissions.addAddressScope(primary, 'credential:contactissue'));
    await execute(permissions.connect(primarySigner).addOperatorKey(primary, operator));

    await execute(
      metadata
        .connect(operatorSigner)
        .newMetadataList(1, '0x6733', '0x6733', '0xabcd', 'traceId', 'caoDid'),
    );
    await execute(
      metadata
        .connect(operatorSigner)
        .setEntry('0x4ffb', '0x1234', 1, 0, 'traceId', 'caoDid'),
    );

    const upgradedMetadata = await upgrades.upgradeProxy(
      metadataAddress,
      MetadataRegistry,
      { kind: 'transparent' },
    );

    const entries = await upgradedMetadata.getFreeEntries([
      { accountId: primary, listId: 1, index: 0 },
    ]);

    assert.equal(entries.length, 1);
    assert.equal(entries[0].credentialType, '0x4ffb');
    assert.equal(entries[0].encryptedPublicKey, '0x1234');
    assert.equal(entries[0].issuerVc, '0xabcd');
  });
});
