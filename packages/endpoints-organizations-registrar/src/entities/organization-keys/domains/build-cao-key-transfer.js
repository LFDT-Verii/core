const { includes, isEmpty, pick } = require('lodash/fp');
const newError = require('http-errors');
const { hexFromJwk, KeyAlgorithms, KeyEncodings } = require('@verii/crypto');

/**
 * Builds a key for a create_tenant message to a CAO.
 *
 * Keys are always sent as JWKs. secp256k1 keys are also sent as hex unless the CAO
 * declared that it doesn't read hex. Hex carries no curve, so keys of other
 * algorithms are only sent as JWKs, and only to CAOs that declared the algorithm.
 * @param {{id: string, algorithm?: string, purposes: string[]}} organizationKey the organization key
 * @param {{privateJwk: JsonWebKey}} kmsEntry the organization key's KMS export
 * @param {{algorithms?: string[], encodings?: string[]}} [keyTransfer] the CAO's declared capabilities
 * @returns {Object} the key for the create_tenant message
 */
const buildCaoKeyTransfer = (
  { id, algorithm, purposes },
  { privateJwk },
  keyTransfer,
) => {
  const keyAlgorithm = resolveKeyAlgorithm(algorithm, privateJwk);
  const { algorithms, encodings } = withDefaults(keyTransfer);
  if (!includes(keyAlgorithm, algorithms)) {
    throw newError(
      400,
      `The CAO hasn't declared that it accepts ${keyAlgorithm} keys`,
      { errorCode: 'key_algorithm_not_accepted' },
    );
  }

  const key = {
    kidFragment: id,
    algorithm: keyAlgorithm,
    purposes,
    jwk: pick(PRIVATE_JWK_MEMBERS, privateJwk),
    publicJwk: pick(PUBLIC_JWK_MEMBERS, privateJwk),
  };
  if (
    keyAlgorithm !== KeyAlgorithms.SECP256K1 ||
    !includes(KeyEncodings.HEX, encodings)
  ) {
    return { ...key, encoding: KeyEncodings.JWK };
  }
  return {
    ...key,
    encoding: KeyEncodings.HEX,
    key: hexFromJwk(privateJwk),
    publicKey: hexFromJwk(privateJwk, false),
  };
};

const CURVE_ALGORITHMS = {
  secp256k1: KeyAlgorithms.SECP256K1,
  'P-256': KeyAlgorithms.ES256,
};

const DEFAULT_KEY_TRANSFER = {
  algorithms: [KeyAlgorithms.SECP256K1],
  encodings: [KeyEncodings.HEX, KeyEncodings.JWK],
};

const PUBLIC_JWK_MEMBERS = ['kty', 'crv', 'x', 'y'];

const PRIVATE_JWK_MEMBERS = [...PUBLIC_JWK_MEMBERS, 'd'];

const resolveKeyAlgorithm = (algorithm, privateJwk) => {
  const curveAlgorithm = CURVE_ALGORITHMS[privateJwk?.crv];
  if (curveAlgorithm == null) {
    throw new Error(`Keys on curve ${privateJwk?.crv} can't be transferred`);
  }
  if (algorithm != null && algorithm !== curveAlgorithm) {
    throw new Error(
      `Key algorithm ${algorithm} doesn't match its ${privateJwk.crv} key`,
    );
  }
  return curveAlgorithm;
};

const withDefaults = (keyTransfer) => ({
  algorithms: isEmpty(keyTransfer?.algorithms)
    ? DEFAULT_KEY_TRANSFER.algorithms
    : keyTransfer.algorithms,
  encodings: isEmpty(keyTransfer?.encodings)
    ? DEFAULT_KEY_TRANSFER.encodings
    : keyTransfer.encodings,
});

module.exports = { buildCaoKeyTransfer };
