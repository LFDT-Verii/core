const { filter, includes, isEmpty, pick, values } = require('lodash/fp');
const newError = require('http-errors');
const { hexFromJwk, KeyAlgorithms, KeyEncodings } = require('@verii/crypto');

/**
 * Builds a key for a create_tenant message to a CAO.
 *
 * secp256k1 keys are sent in the encodings the CAO declared, and as hex when it
 * declared none. Hex carries no curve, so keys of other algorithms are only sent as
 * JWKs, and only to CAOs that declared the algorithm.
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

  const metadata = { kidFragment: id, algorithm: keyAlgorithm, purposes };
  if (keyAlgorithm !== KeyAlgorithms.SECP256K1) {
    return {
      ...metadata,
      encoding: KeyEncodings.JWK,
      ...jwkMembers(privateJwk),
    };
  }
  return { ...metadata, ...secp256k1Members(privateJwk, encodings) };
};

const CURVE_ALGORITHMS = {
  secp256k1: KeyAlgorithms.SECP256K1,
  'P-256': KeyAlgorithms.ES256,
};

const DEFAULT_KEY_TRANSFER = {
  algorithms: [KeyAlgorithms.SECP256K1],
  encodings: [KeyEncodings.HEX],
};

const KNOWN_ENCODINGS = [KeyEncodings.HEX, KeyEncodings.JWK];

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

// A declaration that lists no values the registrar knows counts as not declared.
const withDefaults = (keyTransfer) => ({
  algorithms: knownOrDefault(
    keyTransfer?.algorithms,
    values(CURVE_ALGORITHMS),
    DEFAULT_KEY_TRANSFER.algorithms,
  ),
  encodings: knownOrDefault(
    keyTransfer?.encodings,
    KNOWN_ENCODINGS,
    DEFAULT_KEY_TRANSFER.encodings,
  ),
});

const knownOrDefault = (declared, known, defaults) => {
  const knownDeclared = filter((value) => includes(value, known), declared);
  return isEmpty(knownDeclared) ? defaults : knownDeclared;
};

const secp256k1Members = (privateJwk, encodings) => {
  const sendsHex = includes(KeyEncodings.HEX, encodings);
  return {
    encoding: sendsHex ? KeyEncodings.HEX : KeyEncodings.JWK,
    ...(sendsHex ? hexMembers(privateJwk) : {}),
    ...(includes(KeyEncodings.JWK, encodings) ? jwkMembers(privateJwk) : {}),
  };
};

const hexMembers = (privateJwk) => ({
  key: hexFromJwk(privateJwk),
  publicKey: hexFromJwk(privateJwk, false),
});

const jwkMembers = (privateJwk) => ({
  jwk: pick(PRIVATE_JWK_MEMBERS, privateJwk),
  publicJwk: pick(PUBLIC_JWK_MEMBERS, privateJwk),
});

module.exports = { buildCaoKeyTransfer };
