const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const permissionsPackageDir = path.resolve(__dirname, 'permissions');

const normalizeAddress = (address) => {
  if (typeof address !== 'string') {
    return null;
  }

  const value = address.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    return null;
  }

  return value;
};

const ensureAddress = (address, label) => {
  const normalizedAddress = normalizeAddress(address);
  if (!normalizedAddress) {
    throw new Error(`Invalid ${label}: ${String(address)}`);
  }

  return normalizedAddress;
};

const getChainId = async (ethers) => {
  const network = await ethers.provider.getNetwork();
  return Number(network.chainId);
};

const readManifest = (packageDir, chainId) => {
  const manifestPath = path.join(
    packageDir,
    '.openzeppelin',
    `unknown-${String(chainId)}.json`,
  );

  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Failed to parse OpenZeppelin manifest at "${manifestPath}": ${error && error.message ? error.message : String(error)}`,
    );
  }
  return {
    manifestPath,
    manifest,
  };
};

const resolveProxyAddress = ({
  envVar,
  manifest,
  preferredIndex,
  fallback = 'last',
  label,
}) => {
  const envValue = process.env[envVar];
  if (envValue) {
    return ensureAddress(envValue, `${label} (${envVar})`);
  }

  const proxies = manifest?.proxies || [];
  if (proxies.length === 0) {
    return null;
  }

  const hasPreferredIndex =
    Number.isInteger(preferredIndex) &&
    preferredIndex >= 0 &&
    preferredIndex < proxies.length;
  if (hasPreferredIndex) {
    return ensureAddress(
      proxies[preferredIndex].address,
      `${label} manifest proxy index ${preferredIndex}`,
    );
  }

  const selectedProxy =
    fallback === 'first' ? proxies[0] : proxies[proxies.length - 1];
  return ensureAddress(selectedProxy.address, `${label} manifest proxy`);
};

// Metadata registry stores credential types as bytes2 values, so we
// intentionally keep only the first 2 bytes (4 hex chars) of the digest.
const get2BytesHash = (value) =>
  `0x${createHash('sha256').update(value).digest('hex').slice(0, 4)}`;

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

module.exports = {
  ensureAddress,
  get2BytesHash,
  getChainId,
  readManifest,
  resolvePermissionsAddress,
  resolveProxyAddress,
};
