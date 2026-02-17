const assert = require('node:assert/strict');
const path = require('path');
const {
  getChainId,
  readManifest,
  resolveProxyAddress,
} = require('../hardhat.deploy-utils');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const normalizeAddress = (value) => String(value || '').toLowerCase();

const assertAddressEqual = (actual, expected, label) => {
  assert.equal(
    normalizeAddress(actual),
    normalizeAddress(expected),
    `${label}: expected ${expected}, got ${actual}`,
  );
};

const assertHasCode = async (ethers, address, label) => {
  const code = await ethers.provider.getCode(address);
  assert.notEqual(code, '0x', `${label} has no bytecode at ${address}`);
};

const resolveManagedProxy = async ({
  ethers,
  packageDir,
  envVar,
  preferredIndex = 0,
  fallback = 'first',
  label,
}) => {
  const chainId = await getChainId(ethers);
  const manifestData = readManifest(packageDir, chainId);
  const address = resolveProxyAddress({
    envVar,
    manifest: manifestData?.manifest,
    preferredIndex,
    fallback,
    label,
  });

  if (!address) {
    const expectedManifestPath = path.join(
      packageDir,
      '.openzeppelin',
      `unknown-${String(chainId)}.json`,
    );
    throw new Error(
      `Unable to resolve ${label} for chain ${chainId}. ` +
        `Set ${envVar} or provide manifest at ${expectedManifestPath}`,
    );
  }

  return { address, chainId };
};

const smokeEnabled = () => process.env.POST_UPGRADE_SMOKE === '1';

module.exports = {
  ZERO_ADDRESS,
  assertAddressEqual,
  assertHasCode,
  resolveManagedProxy,
  smokeEnabled,
};
