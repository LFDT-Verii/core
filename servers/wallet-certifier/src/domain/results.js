const { fingerprintJwt } = require('./evidence');

const PASSING_CHECK_RESULTS = new Set(['PASS', 'NOT_APPLICABLE', 'SKIPPED']);

const checksPass = (checks = {}) =>
  Object.values(checks).every((result) => PASSING_CHECK_RESULTS.has(result));

const credentialPasses = (credential) =>
  credential.verified === true && checksPass(credential.checks);

const evaluateVerification = ({
  presentation,
  setupFingerprint,
  credentials = [],
}) => {
  const setupBadgePresent = credentials.some(
    ({ jwt }) => jwt && fingerprintJwt(jwt) === setupFingerprint,
  );
  return {
    passed:
      presentation?.verified === true &&
      setupBadgePresent &&
      credentials.every(credentialPasses),
    setupBadgePresent,
  };
};

module.exports = { evaluateVerification };
