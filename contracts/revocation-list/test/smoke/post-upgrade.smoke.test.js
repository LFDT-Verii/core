const path = require('path');
const { ethers } = require('hardhat');
const {
  assertAddressEqual,
  assertHasCode,
  resolveManagedProxy,
  smokeEnabled,
} = require('../../../test-utils/post-upgrade-smoke');

const describeSmoke = smokeEnabled() ? describe : describe.skip;

describeSmoke('RevocationRegistry post-upgrade smoke', function () {
  this.timeout(120000);

  it('resolves deployed proxies and validates permissions wiring', async () => {
    const revocationPackageDir = path.resolve(__dirname, '../..');
    const permissionsPackageDir = path.resolve(
      __dirname,
      '../../../permissions',
    );

    const { address: permissionsAddress, chainId } = await resolveManagedProxy({
      ethers,
      packageDir: permissionsPackageDir,
      envVar: 'PERMISSIONS_PROXY_ADDRESS',
      preferredIndex: 0,
      fallback: 'first',
      label: 'permissions proxy',
    });
    const { address: revocationAddress } = await resolveManagedProxy({
      ethers,
      packageDir: revocationPackageDir,
      envVar: 'REVOCATION_PROXY_ADDRESS',
      preferredIndex: 0,
      fallback: 'first',
      label: 'revocation proxy',
    });

    await assertHasCode(ethers, permissionsAddress, 'permissions proxy');
    await assertHasCode(ethers, revocationAddress, 'revocation proxy');

    const revocation = await ethers.getContractAt(
      'RevocationRegistry',
      revocationAddress,
    );
    const currentPermissionsAddress = await revocation.getPermissionsAddress();
    assertAddressEqual(
      currentPermissionsAddress,
      permissionsAddress,
      `RevocationRegistry permissions wiring on chain ${chainId}`,
    );
  });
});
