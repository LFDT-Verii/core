const { flow, filter, first, isEmpty, pick, values } = require('lodash/fp');
const newError = require('http-errors');

const keyPairs = {
  secp256k1: {
    id: '9dqEq7bVkmjiw5Wi5oxim',
    // eslint-disable-next-line max-len
    did: 'did:jwk:eyJjcnYiOiJzZWNwMjU2azEiLCJrdHkiOiJFQyIsIngiOiJBWkpreFVRZlNwS3VvNjVaMWlSeWJZallaRUZOQ2N4VzA2TURCOEpjSHdBIiwieSI6Im5uQk5yZ09OeEFkbGFwZ2RSWlpzT1FxQkNZREFieWtnQ2R2b1ZiNWxtVVkifQ',
    // eslint-disable-next-line max-len
    kid: 'did:jwk:eyJjcnYiOiJzZWNwMjU2azEiLCJrdHkiOiJFQyIsIngiOiJBWkpreFVRZlNwS3VvNjVaMWlSeWJZallaRUZOQ2N4VzA2TURCOEpjSHdBIiwieSI6Im5uQk5yZ09OeEFkbGFwZ2RSWlpzT1FxQkNZREFieWtnQ2R2b1ZiNWxtVVkifQ#0',
    alg: 'ES256K',
    publicKey: {
      kty: 'EC',
      x: 'AZJkxUQfSpKuo65Z1iRybYjYZEFNCcxW06MDB8JcHwA',
      y: 'nnBNrgONxAdlapgdRZZsOQqBCYDAbykgCdvoVb5lmUY',
      crv: 'secp256k1',
    },
    privateKey: {
      kty: 'EC',
      x: 'AZJkxUQfSpKuo65Z1iRybYjYZEFNCcxW06MDB8JcHwA',
      y: 'nnBNrgONxAdlapgdRZZsOQqBCYDAbykgCdvoVb5lmUY',
      crv: 'secp256k1',
      d: 'Sn1OGP_FWYqv0EpfjIY-hL9XMp1JI6X3l-M8ovtz3ng',
    },
  },
  'P-256': {
    id: 'Iv5pwCQfp6e5FsncVgVX0',
    // eslint-disable-next-line max-len
    did: 'did:jwk:eyJjcnYiOiJQLTI1NiIsImt0eSI6IkVDIiwieCI6IkFYQWxaWThqNGh5cm10dzBoRjNrLTJWT080THZXRzBLNEF5a0JYS25HVWciLCJ5IjoiYzlEVHE5cVRWUTlRQmlsLUgxdGRWN3FZZERic3BhTG5wZ0FJdkRKeEpHayJ9',
    // eslint-disable-next-line max-len
    kid: 'did:jwk:eyJjcnYiOiJQLTI1NiIsImt0eSI6IkVDIiwieCI6IkFYQWxaWThqNGh5cm10dzBoRjNrLTJWT080THZXRzBLNEF5a0JYS25HVWciLCJ5IjoiYzlEVHE5cVRWUTlRQmlsLUgxdGRWN3FZZERic3BhTG5wZ0FJdkRKeEpHayJ9#0',
    alg: 'ES256',
    publicKey: {
      kty: 'EC',
      x: 'AXAlZY8j4hyrmtw0hF3k-2VOO4LvWG0K4AykBXKnGUg',
      y: 'c9DTq9qTVQ9QBil-H1tdV7qYdDbspaLnpgAIvDJxJGk',
      crv: 'P-256',
    },
    privateKey: {
      kty: 'EC',
      x: 'AXAlZY8j4hyrmtw0hF3k-2VOO4LvWG0K4AykBXKnGUg',
      y: 'c9DTq9qTVQ9QBil-H1tdV7qYdDbspaLnpgAIvDJxJGk',
      crv: 'P-256',
      d: 'fcZ8We_GOQKA_hC4ovf4UcBnwfcTVkHGwxhN3WDzD7M',
    },
  },
};

const getKeyPair = ({ kid, keyId }) => {
  let matcher;

  if (!isEmpty(kid)) {
    matcher = { kid };
  } else if (!isEmpty(keyId)) {
    matcher = { id: keyId };
  }

  const keyPairEntry = flow(filter(matcher), first)(values(keyPairs));

  if (isEmpty(keyPairEntry)) {
    throw newError(400, 'Key pair not found', {
      errorCode: `invalid_${!isEmpty(kid) ? 'kid' : 'key_id'}`,
    });
  }

  return pick(['publicKey', 'privateKey', 'alg'], keyPairEntry);
};

const generateJwk = (curve) => {
  return keyPairs[curve];
};

module.exports = { generateJwk, getKeyPair };
