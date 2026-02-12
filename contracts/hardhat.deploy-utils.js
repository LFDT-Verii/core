const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');

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

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
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

const get2BytesHash = (value) =>
  `0x${createHash('sha256').update(value).digest('hex').slice(0, 4)}`;

module.exports = {
  ensureAddress,
  get2BytesHash,
  getChainId,
  readManifest,
  resolveProxyAddress,
};
