const { isEmpty } = require('lodash/fp');
const { jwtSign, publicKeyFromPrivateKey, toJwk } = require('@verii/jwt');
const { getDidUriFromJwk } = require('@verii/did-doc');
const common = require('../common');

const generateProof = async (options) => {
  try {
    const nonce = loadNonce(options);
    const personaInfo = await common.loadPersonaFiles(options.persona);
    const publicKey = publicKeyFromPrivateKey(personaInfo.privateKey);
    const proofJwt = await buildProofJwt({
      nonce,
      keyPair: {
        publicKey,
        privateKey: personaInfo.privateKey,
      },
      typ: options.openid4vci ? 'openid4vci-proof+jwt' : 'JWT',
      options,
    });
    common.printInfo(`\nGenerated proof jwt:\n${proofJwt}\n`);
    common.writeFile('proof.jwt', proofJwt);
    return proofJwt;
  } catch (ex) {
    common.printError(ex);
    throw ex;
  }
};

const loadNonce = (options) => {
  if (!isEmpty(options.challenge)) {
    return options.challenge;
  }

  const response = JSON.parse(
    common.readFile(
      `${options.response}`,
      'Generate Offers Response not found',
    ),
  );
  return response.challenge;
};

const buildProofJwt = async ({ nonce, keyPair, typ, options }) => {
  const kid = getDidUriFromJwk(toJwk(keyPair.publicKey, false));
  const jwt = await jwtSign(
    { aud: options.audience, nonce, iss: kid },
    toJwk(keyPair.privateKey),
    {
      kid: `${kid}#0`,
      typ,
    },
  );
  return jwt;
};

module.exports = {
  generateProof,
};
