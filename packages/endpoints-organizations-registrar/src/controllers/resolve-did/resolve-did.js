const newError = require('http-errors');
const { resolveDidWeb, isWebDid } = require('@verii/did-web');
const { buildDidDocWithAlternativeId } = require('@verii/did-doc');
const { isEmpty } = require('lodash/fp');

const resolveDid = async (did, context) => {
  if (isWebDid(did)) {
    return resolveDidWeb(did).catch((error) => {
      if (error.errorCode === 'did_resolution_failed') {
        throw newError(404, error.message, { errorCode: error.errorCode });
      }
      throw error;
    });
  }
  return resolveLocalDid(did, context);
};

const resolveLocalDid = async (did, { repos }) => {
  const organization = await repos.organizations.findOneByDid(did);
  const didDoc = organization?.didDoc;

  if (isEmpty(didDoc)) {
    throw newError(404, `Could not resolve ${did}`, {
      errorCode: 'did_resolution_failed',
    });
  }
  return buildDidDocWithAlternativeId(did, didDoc);
};

module.exports = { resolveDid };
