const { map } = require('lodash/fp');
const {
  generateKeyPair,
  KeyPurposes,
  KeyAlgorithms,
} = require('@verii/crypto');
const { createDidDoc } = require('@verii/did-doc');
const { mapWithIndex } = require('@verii/common-functions');
const { normalizeProfileName, buildCustodiedDidWeb } = require('../domains');
const {
  buildOrganizationServices,
  loadCaoServiceRefs,
  validateServices,
} = require('../../organization-services');

const buildCustodiedOrganization = async (
  { profile, serviceEndpoints, invitation },
  context
) => {
  const newServices = buildOrganizationServices(serviceEndpoints, invitation);

  const caoServiceRefs = await loadCaoServiceRefs(serviceEndpoints, context);
  validateServices(newServices, caoServiceRefs, context);
  const newKeyPairs = map(() => generateKeyPair({ format: 'jwk' }), keySpecs);

  const kmsKeyEntries = await Promise.all(
    map(
      (newKeyPair) =>
        context.kms.importKey({
          ...newKeyPair,
          algorithm: 'ec',
          curve: 'secp256k1',
        }),
      newKeyPairs
    )
  );

  const newKeys = mapWithIndex(
    (keySpec, i) => ({
      ...keySpec,
      kmsKeyId: kmsKeyEntries[i].id,
      algorithm: KeyAlgorithms.SECP256K1,
      custodied: true,
      publicKey: newKeyPairs[i].publicKey,
    }),
    keySpecs
  );

  const did = buildCustodiedDidWeb(profile, context);

  const { didDoc } = createDidDoc({
    did,
    services: newServices,
    keys: newKeys,
  });

  return {
    newOrganization: {
      didDoc,
      profile,
      normalizedProfileName: normalizeProfileName(profile.name),
      didNotCustodied: false,
      services: newServices,
      invitationId: invitation?._id,
    },
    newKeys,
    newKeyPairs,
    caoServiceRefs,
  };
};

const keySpecs = [
  {
    id: '#vc-signing-key-1',
    type: 'EcdsaSecp256k1VerificationKey2019',
    purposes: [KeyPurposes.ISSUING_METADATA],
  },
  {
    id: '#eth-account-key-1',
    type: 'EcdsaSecp256k1VerificationKey2019',
    purposes: [KeyPurposes.DLT_TRANSACTIONS],
  },
  {
    id: '#exchange-key-1',
    type: 'EcdsaSecp256k1VerificationKey2019',
    purposes: [KeyPurposes.EXCHANGES],
  },
];

module.exports = {
  buildCustodiedOrganization,
};
