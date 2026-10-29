const newError = require('http-errors');
const { isEmpty } = require('lodash/fp');
const { resolveDidWeb, isWebDid } = require('@verii/did-web');
const { buildDidDocWithAlternativeId } = require('@verii/did-doc');
const { isCustodiedDidWeb } = require('../domains/build-custodied-did-web');

const resolveDid = async (did, context) => {
  if (isCustodiedDidWeb(did, context)) {
    return resolveCustodiedDidWeb(did, context);
  }
  if (isWebDid(did)) {
    return resolveDidWeb(did);
  }
  return resolveLocalDid(did, context);
};

// Read the document the registrar would serve at /d/<website>/did.json, instead of fetching it back over the internet.
const resolveCustodiedDidWeb = async (did, { repos }) => {
  const organization = await repos.organizations.findOne(
    { filter: { 'didDoc.id': did, '@ignoreScope': true } },
    { didDoc: 1 },
  );
  if (isEmpty(organization?.didDoc)) {
    throw newError(400, `Could not resolve ${did}: DID document not found`, {
      errorCode: 'did_resolution_failed',
    });
  }
  return organization.didDoc;
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
