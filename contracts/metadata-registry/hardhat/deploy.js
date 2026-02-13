const path = require('path');
const { ethers, upgrades } = require('hardhat');
const {
  get2BytesHash,
  getChainId,
  readManifest,
  resolvePermissionsAddress,
  resolveProxyAddress,
} = require('../../hardhat.deploy-utils');

const couponPackageDir = path.resolve(__dirname, '../../verification-coupon');

const freeCredentialTypes = [
  'Email',
  'EmailV1.0',
  'Phone',
  'PhoneV1.0',
  'IdDocument',
  'IdDocumentV1.0',
  'PassportV1.0',
  'DriversLicenseV1.0',
  'NationalIdCardV1.0',
  'ProofOfAgeV1.0',
  'ResidentPermitV1.0',
  'VerificationIdentifier',
];

const resolveCouponAddress = (chainId) => {
  const manifestData = readManifest(couponPackageDir, chainId);
  const explicitIndex = Number(process.env.COUPON_PROXY_INDEX);
  const preferredIndex = Number.isInteger(explicitIndex) ? explicitIndex : 0;
  return resolveProxyAddress({
    envVar: 'COUPON_PROXY_ADDRESS',
    manifest: manifestData?.manifest,
    preferredIndex,
    fallback: 'last',
    label: 'verification-coupon proxy',
  });
};

async function main() {
  const chainId = await getChainId(ethers);
  const couponAddress = resolveCouponAddress(chainId);
  const permissionsAddress = resolvePermissionsAddress(chainId);

  if (!couponAddress) {
    throw new Error(
      'Coupon proxy address is required (set COUPON_PROXY_ADDRESS or provide coupon manifest)',
    );
  }

  if (!permissionsAddress) {
    throw new Error(
      'Permissions proxy address is required (set PERMISSIONS_PROXY_ADDRESS or provide permissions manifest)',
    );
  }

  const MetadataRegistry = await ethers.getContractFactory('MetadataRegistry');
  const instance = await upgrades.deployProxy(
    MetadataRegistry,
    [couponAddress, freeCredentialTypes.map(get2BytesHash)],
    {
      kind: 'transparent',
      initializer: 'initialize',
    },
  );
  await instance.waitForDeployment();

  const setPermissionsTx = await instance.setPermissionsAddress(
    permissionsAddress,
  );
  await setPermissionsTx.wait();

  const permissions = await ethers.getContractAt('Permissions', permissionsAddress);
  const metadataAddress = await instance.getAddress();
  const hasBurnScope = await permissions.checkAddressScope(
    metadataAddress,
    'coupon:burn',
  );
  if (!hasBurnScope) {
    const addScopeTx = await permissions.addAddressScope(
      metadataAddress,
      'coupon:burn',
    );
    await addScopeTx.wait();
  }

  console.log(`METADATA_PROXY_ADDRESS=${metadataAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
