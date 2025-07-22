const { generateCredentialJwt } = require('@verii/jwt');
const { VerifiableCredentialTypes } = require('@verii/verifiable-credentials');
const { v4: uuid } = require('uuid');
const { buildPublicProfile } = require('./build-public-profile');

const initBuildProfileVerifiableCredential =
  ({ config: { rootDid, rootPrivateKey, rootKid } }) =>
  async (profile, didDoc) => {
    const id = uuid();

    const credential = {
      id,
      type: [
        VerifiableCredentialTypes.BASIC_PROFILE_V1_0,
        VerifiableCredentialTypes.VERIFIABLE_CREDENTIAL,
      ],
      issuer: {
        id: rootDid,
      },
      credentialSubject: {
        id: didDoc.id,
        alsoKnownAs: didDoc.alsoKnownAs,
        ...buildPublicProfile(profile),
      },
    };
    const jwtVc = await generateCredentialJwt(
      credential,
      rootPrivateKey,
      rootKid
    );
    return { jwtVc, credentialId: id };
  };

module.exports = {
  initBuildProfileVerifiableCredential,
};
