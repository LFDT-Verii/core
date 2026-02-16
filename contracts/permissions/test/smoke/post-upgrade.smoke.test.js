const assert = require('node:assert/strict');
const path = require('path');
const { ethers } = require('hardhat');
const {
  ZERO_ADDRESS,
  assertHasCode,
  resolveManagedProxy,
  smokeEnabled,
} = require('../../../test-utils/post-upgrade-smoke');

const describeSmoke = smokeEnabled() ? describe : describe.skip;

describeSmoke('Permissions post-upgrade smoke', function () {
  this.timeout(120000);

  it('resolves deployed proxy and reads core state', async () => {
    const packageDir = path.resolve(__dirname, '../..');
    const { address: permissionsAddress, chainId } = await resolveManagedProxy({
      ethers,
      packageDir,
      envVar: 'PERMISSIONS_PROXY_ADDRESS',
      preferredIndex: 0,
      fallback: 'first',
      label: 'permissions proxy',
    });

    await assertHasCode(ethers, permissionsAddress, 'permissions proxy');

    const permissions = await ethers.getContractAt('Permissions', permissionsAddress);
    const vnf = await permissions.getVNF();
    assert.notEqual(
      vnf,
      ZERO_ADDRESS,
      `Permissions VNF is zero on chain ${chainId}`,
    );

    const primaries = await permissions.getPrimaries();
    assert.ok(Array.isArray(primaries), 'getPrimaries should return an array');
  });
});
