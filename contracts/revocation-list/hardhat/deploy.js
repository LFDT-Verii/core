const path = require('path');
const { ethers, upgrades } = require('hardhat');
const {
  getChainId,
  readManifest,
  resolveProxyAddress,
} = require('../../hardhat.deploy-utils');

const permissionsPackageDir = path.resolve(__dirname, '../../permissions');

const resolvePermissionsAddress = (chainId) => {
  const manifestData = readManifest(permissionsPackageDir, chainId);
  return resolveProxyAddress({
    envVar: 'PERMISSIONS_PROXY_ADDRESS',
    manifest: manifestData?.manifest,
    preferredIndex: 0,
    fallback: 'first',
    label: 'permissions proxy',
  });
};

async function main() {
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
  const instance = await upgrades.deployProxy(RevocationRegistry, [], {
    kind: 'transparent',
    initializer: 'initialize',
  });
  await instance.waitForDeployment();

  const tx = await instance.setPermissionsAddress(permissionsAddress);
  await tx.wait();

  console.log(`REVOCATION_PROXY_ADDRESS=${await instance.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
