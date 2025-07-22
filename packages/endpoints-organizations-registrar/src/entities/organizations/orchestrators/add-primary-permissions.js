const {
  toEthereumAddress,
} = require('@verii/blockchain-functions');
const { initPermissions } = require('@verii/contract-permissions');

const addPrimaryPermissions = async (
  { primaryAccount, rotationKeyPair, permissioningKeyPair },
  context
) => {
  const {
    config: { rootPrivateKey, permissionsContractAddress },
    rpcProvider,
  } = context;

  const permissionRootContract = await initPermissions(
    {
      privateKey: rootPrivateKey,
      contractAddress: permissionsContractAddress,
      rpcProvider,
    },
    context
  );
  await permissionRootContract.addPrimary({
    primary: primaryAccount,
    permissioning: toEthereumAddress(permissioningKeyPair.publicKey),
    rotation: toEthereumAddress(rotationKeyPair.publicKey),
  });
};

module.exports = { addPrimaryPermissions };
