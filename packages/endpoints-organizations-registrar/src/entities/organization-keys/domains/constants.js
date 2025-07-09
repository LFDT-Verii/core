// const KeyAlgorithms = {
//   SECP256K1: 'SECP256K1',
// };
//
// const KeyEncodings = {
//   HEX: 'hex',
// };

const KeyErrorMessages = {
  UNRECOGNIZED_PURPOSE_DETECTED: 'Unrecognized purpose detected',
  DUPLICATE_PURPOSE_DETECTED: 'Duplicate key purposes detected',
  PUBLIC_KEY_MUST_BE_SPECIFIED_IF_ENCODING_IS_SPECIFIED:
    'publicKey must be specified if encoding is specified',
  ENCODING_MUST_BE_SPECIFIED_IF_PUBLIC_KEY_IS_SPECIFIED:
    'encoding must be specified if publicKey is specified',
  PUBLIC_KEY_ENCODING_DOES_NOT_MATCH_SPECIFIED_ENCODING:
    'publicKey encoding does not match specified encoding',
  KEY_WITH_ID_FRAGMENT_ALREADY_EXISTS_TEMPLATE: ({ kidFragment }) =>
    `Key with kidFragment ${kidFragment} already exists`,
  PUBLIC_KEY_ALREADY_EXISTS_TEMPLATE: ({ publicKey }) =>
    `publicKey ${publicKey} already exists`,
  // UNRECOGNIZED_ALGORITHM: 'Unrecognized algorithm',
  // UNRECOGNIZED_ENCODING: 'Unrecognized encoding',
};

module.exports = {
  // KeyAlgorithms,
  // KeyEncodings,
  KeyErrorMessages,
};
