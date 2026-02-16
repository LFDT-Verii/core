const assert = require('node:assert/strict');
const path = require('path');
const { ethers } = require('hardhat');
const {
  assertAddressEqual,
  assertHasCode,
  resolveManagedProxy,
  smokeEnabled,
} = require('../../../test-utils/post-upgrade-smoke');

const describeSmoke = smokeEnabled() ? describe : describe.skip;

describeSmoke('MetadataRegistry post-upgrade smoke', function () {
  this.timeout(120000);

  it('resolves deployed proxies and validates metadata wiring invariants', async () => {
    const metadataPackageDir = path.resolve(__dirname, '../..');
    const permissionsPackageDir = path.resolve(__dirname, '../../../permissions');

    const { address: permissionsAddress, chainId } = await resolveManagedProxy({
      ethers,
      packageDir: permissionsPackageDir,
      envVar: 'PERMISSIONS_PROXY_ADDRESS',
      preferredIndex: 0,
      fallback: 'first',
      label: 'permissions proxy',
    });
    const { address: metadataAddress } = await resolveManagedProxy({
      ethers,
      packageDir: metadataPackageDir,
      envVar: 'METADATA_PROXY_ADDRESS',
      preferredIndex: 0,
      fallback: 'first',
      label: 'metadata proxy',
    });

    await assertHasCode(ethers, permissionsAddress, 'permissions proxy');
    await assertHasCode(ethers, metadataAddress, 'metadata proxy');

    const metadata = await ethers.getContractAt('MetadataRegistry', metadataAddress);
    const permissions = await ethers.getContractAt('Permissions', permissionsAddress);

    const currentPermissionsAddress = await metadata.getPermissionsAddress();
    assertAddressEqual(
      currentPermissionsAddress,
      permissionsAddress,
      `MetadataRegistry permissions wiring on chain ${chainId}`,
    );

    const hasBurnScope = await permissions.checkAddressScope(
      metadataAddress,
      'coupon:burn',
    );
    assert.equal(
      hasBurnScope,
      true,
      `MetadataRegistry missing coupon:burn scope on chain ${chainId}`,
    );
  });
});
