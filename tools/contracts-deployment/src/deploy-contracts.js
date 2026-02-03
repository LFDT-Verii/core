const console = require('console');
const { get2BytesHash } = require('@verii/crypto');
const ethers = require('ethers');
const permissionsContractAbi = require('@verii/contract-permissions/src/contracts/permissions.json');
const verificationCouponContractAbi = require('@verii/metadata-registration/src/contracts/verification-coupon.json');
const metadataRegistryContractAbi = require('@verii/metadata-registration/src/contracts/metadata-registry.json');
const revocationRegistryContractAbi = require('@verii/metadata-registration/src/contracts/revocation-registry.json');

const rpcUrl = process.env.RPC_NODE_URL ?? 'http://localhost:8545';
const privateKey =
  process.env.PRIVATE_KEY ??
  'e090d2f5ba3f22f818190f6f0380e68a1608f307461a8db6066e3d64b57c9f0c';
const name = 'Velocity Verification Coupon';
const baseTokenURI = 'https://www.velocitynetwork.foundation/';
const freeCredentialTypes = [
  'Email',
  'EmailV1.0',
  'Phone',
  'PhoneV1.0',
  'IdDocument',
  'IdDocumentV1.0',
  'PassportV1.0',
  'DrivingLicenseV1.0',
  'NationalIdCardV1.0',
  'ProofOfAgeV1.0',
  'ResidentPermitV1.0',
];

const deployContract = async (
  contractAbi,
  deployerPrivateKey,
  deployRpcUrl,
  initializer,
) => {
  const provider = new ethers.JsonRpcProvider(deployRpcUrl);

  provider.pollingInterval = 100;
  const wallet = new ethers.Wallet(`0x${deployerPrivateKey}`, provider);
  const factory = new ethers.ContractFactory(
    contractAbi.abi,
    contractAbi.bytecode,
    wallet,
  );
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const transaction = initializer
    ? await initializer(contract)
    : await contract.initialize();
  await transaction.wait();
  return contract;
};

const main = async () => {
  console.info(
    `Deploying contract to ${rpcUrl} using key ending with ${privateKey.slice(
      -4,
    )}`,
  );
  const permissionsContract = await deployContract(
    permissionsContractAbi,
    privateKey,
    rpcUrl,
  );
  const permissionsContractAddress = await permissionsContract.getAddress();
  console.log(`PERMISSIONS_CONTRACT_ADDRESS=${permissionsContractAddress}`);

  const verificationCouponContract = await deployContract(
    verificationCouponContractAbi,
    privateKey,
    rpcUrl,
    (contract) => contract.initialize(name, baseTokenURI),
  );
  await verificationCouponContract.setPermissionsAddress(
    permissionsContractAddress,
  );
  const verificationCouponAddress =
    await verificationCouponContract.getAddress();
  console.log(`COUPON_CONTRACT_ADDRESS=${verificationCouponAddress}`);

  const metadataRegistryContract = await deployContract(
    metadataRegistryContractAbi,
    privateKey,
    rpcUrl,
    async (contract) =>
      contract.initialize(
        verificationCouponAddress,
        freeCredentialTypes.map(get2BytesHash),
      ),
  );
  await metadataRegistryContract.setPermissionsAddress(
    permissionsContractAddress,
  );
  const metadataRegistryAddress = await metadataRegistryContract.getAddress();
  await permissionsContract.addAddressScope(
    metadataRegistryAddress,
    'coupon:burn',
  );
  console.log(`METADATA_REGISTRY_CONTRACT_ADDRESS=${metadataRegistryAddress}`);

  const revocationRegistryContract = await deployContract(
    revocationRegistryContractAbi,
    privateKey,
    rpcUrl,
  );
  await revocationRegistryContract.setPermissionsAddress(
    permissionsContractAddress,
  );
  const revocationRegistryAddress =
    await revocationRegistryContract.getAddress();
  console.log(`REVOCATION_CONTRACT_ADDRESS=${revocationRegistryAddress}`);
};

main().then(() => {});
