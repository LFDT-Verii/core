const { decodeCredentialJwt } = require('@verii/jwt');
const { CredentialCheckResultValue } = require('@verii/verii-verification');
const {
  checkExpiration,
  checkJwsVcTampering,
  CheckResults,
} = require('@verii/vc-checks');

const checkOrgIssuerMatch = ({ issuer }, trustedIssuer) => {
  const id = issuer?.id ?? issuer;
  return id !== trustedIssuer
    ? CredentialCheckResultValue.FAIL
    : CredentialCheckResultValue.PASS;
};

const runAllOrgChecks = async (
  { signedCredential, rootJwk, rootDid },
  context
) => {
  const decodedCredential = await decodeCredentialJwt(signedCredential);

  const tamperingCheck = await checkJwsVcTampering(
    signedCredential,
    rootJwk,
    context
  );

  if (tamperingCheck !== CheckResults.PASS) {
    return {
      UNTAMPERED: tamperingCheck,
      TRUSTED_ISSUER: CredentialCheckResultValue.NOT_CHECKED,
      UNREVOKED: CredentialCheckResultValue.NOT_CHECKED,
      UNEXPIRED: CredentialCheckResultValue.NOT_CHECKED,
      checked: new Date(),
    };
  }

  return {
    UNTAMPERED: tamperingCheck,
    TRUSTED_ISSUER: checkOrgIssuerMatch(decodedCredential, rootDid),
    UNREVOKED: CredentialCheckResultValue.NOT_CHECKED,
    UNEXPIRED: checkExpiration(decodedCredential),
    checked: new Date(),
  };
};

module.exports = {
  runAllOrgChecks,
};
