const privateKeyMatcher = {
  crv: 'secp256k1',
  kty: 'EC',
  d: expect.any(String),
  x: expect.any(String),
  y: expect.any(String),
};

const publicKeyMatcher = {
  crv: 'secp256k1',
  kty: 'EC',
  x: expect.any(String),
  y: expect.any(String),
};

module.exports = {
  privateKeyMatcher,
  publicKeyMatcher,
};
