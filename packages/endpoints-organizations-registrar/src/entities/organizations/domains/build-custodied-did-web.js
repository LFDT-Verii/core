const { startsWith } = require('lodash/fp');
const { uriToDidWeb } = require('@verii/did-web');

const buildCustodiedDidWeb = (profile, { config: { custodiedDidWebHost } }) => {
  const profileUrl = new URL(profile.website);
  const url = new URL(custodiedDidWebHost);
  url.pathname = `/d/${profileUrl.hostname}`;
  return uriToDidWeb(url.href);
};

// Custodied DIDs are did:web:<custodied host>:d:<website>, which the registrar itself serves at /d/<website>/did.json.
const isCustodiedDidWeb = (did, { config: { custodiedDidWebHost } }) =>
  custodiedDidWebHost != null &&
  startsWith(`${uriToDidWeb(new URL('/d', custodiedDidWebHost).href)}:`, did);

module.exports = {
  buildCustodiedDidWeb,
  isCustodiedDidWeb,
};
