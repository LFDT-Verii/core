const { ethers, upgrades } = require('hardhat');
const {
  getChainId,
  resolvePermissionsAddress,
  resolveTxOverrides,
} = require('../../hardhat.deploy-utils');

async function main() {
  const txOverrides = await resolveTxOverrides(ethers);
  const deployOptions = {
    kind: 'transparent',
    initializer: 'initialize',
  };
  if (Object.keys(txOverrides).length > 0) {
    deployOptions.txOverrides = txOverrides;
  }

  const chainId = await getChainId(ethers);
  const permissionsAddress = resolvePermissionsAddress(chainId);
  if (!permissionsAddress) {
    throw new Error(
      'Permissions proxy address is required (set PERMISSIONS_PROXY_ADDRESS or provide permissions manifest)',
    );
  }

  const RevocationRegistry = await ethers.getContractFactory(
    'RevocationRegistry',
  );
  const instance = await upgrades.deployProxy(
    RevocationRegistry,
    [],
    deployOptions,
  );
  await instance.waitForDeployment();

  try {
    const tx = await instance.setPermissionsAddress(
      permissionsAddress,
      txOverrides,
    );
    await tx.wait();
  } catch (error) {
    const originalMessage =
      error && typeof error.message === 'string'
        ? error.message
        : String(error);
    throw new Error(
      `Failed to set permissions address on revocation proxy ${await instance.getAddress()} to ${permissionsAddress}. ` +
        `Ensure the deployer is authorized to call setPermissionsAddress. Original error: ${originalMessage}`,
    );
  }

  console.log(`REVOCATION_PROXY_ADDRESS=${await instance.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
