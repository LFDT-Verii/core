const {
  initBuildProfileVerifiableCredential,
} = require('./build-profile-verifiable-credential');
const { initBuildProfileVcUrl } = require('./build-profile-vc-url');

const initPrepareProfileVc = (fastify) => {
  const buildProfileVerifiableCredential =
    initBuildProfileVerifiableCredential(fastify);
  const buildProfileVcUrl = initBuildProfileVcUrl({
    registrarUrl: fastify.config.hostUrl,
  });
  return async (didDoc, profile) => {
    const { jwtVc, credentialId } = await buildProfileVerifiableCredential(
      profile,
      didDoc
    );

    const vcUrl = buildProfileVcUrl(didDoc, credentialId);

    return {
      credentialId,
      jwtVc,
      vcUrl,
    };
  };
};

module.exports = { initPrepareProfileVc };
