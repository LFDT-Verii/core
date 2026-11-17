const { map, omit } = require('lodash/fp');
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
  context,
) => {
  const newServices = buildOrganizationServices(serviceEndpoints, invitation);

  const caoServiceRefs = await loadCaoServiceRefs(serviceEndpoints, context);
  validateServices(newServices, caoServiceRefs, context);
  const keySpecs = selectKeySpecs(context.config);
  const newKeyPairs = map(
    ({ curve }) => generateKeyPair({ format: 'jwk', curve }),
    keySpecs,
  );

  const kmsKeyEntries = await Promise.all(
    mapWithIndex(
      ({ curve }, i) =>
        context.kms.importKey({
          ...newKeyPairs[i],
          algorithm: 'ec',
          curve,
        }),
      keySpecs,
    ),
  );

  const newKeys = mapWithIndex(
    (keySpec, i) => ({
      ...omit(['curve'], keySpec),
      kmsKeyId: kmsKeyEntries[i].id,
      custodied: true,
      publicKey: newKeyPairs[i].publicKey,
    }),
    keySpecs,
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

const selectKeySpecs = ({ es256OrganizationKeys }) =>
  es256OrganizationKeys ? es256KeySpecs : secp256k1KeySpecs;

const secp256k1KeySpecs = [
  {
    id: '#vc-signing-key-1',
    type: 'EcdsaSecp256k1VerificationKey2019',
    purposes: [KeyPurposes.ISSUING_METADATA],
    algorithm: KeyAlgorithms.SECP256K1,
    curve: 'secp256k1',
  },
  {
    id: '#eth-account-key-1',
    type: 'EcdsaSecp256k1VerificationKey2019',
    purposes: [KeyPurposes.DLT_TRANSACTIONS],
    algorithm: KeyAlgorithms.SECP256K1,
    curve: 'secp256k1',
  },
  {
    id: '#exchange-key-1',
    type: 'EcdsaSecp256k1VerificationKey2019',
    purposes: [KeyPurposes.EXCHANGES],
    algorithm: KeyAlgorithms.SECP256K1,
    curve: 'secp256k1',
  },
];

// The DLT key stays secp256k1: the contracts recover signers with ecrecover.
const es256KeySpecs = [
  {
    id: '#vc-signing-key-1',
    type: 'JsonWebKey2020',
    purposes: [KeyPurposes.ISSUING_METADATA],
    algorithm: KeyAlgorithms.ES256,
    curve: 'P-256',
  },
  {
    id: '#eth-account-key-1',
    type: 'EcdsaSecp256k1VerificationKey2019',
    purposes: [KeyPurposes.DLT_TRANSACTIONS],
    algorithm: KeyAlgorithms.SECP256K1,
    curve: 'secp256k1',
  },
  {
    id: '#exchange-key-1',
    type: 'JsonWebKey2020',
    purposes: [KeyPurposes.EXCHANGES],
    algorithm: KeyAlgorithms.ES256,
    curve: 'P-256',
  },
];

module.exports = {
  buildCustodiedOrganization,
};
