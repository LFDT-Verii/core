const { sprintf } = require('sprintf-js');
const { isEmpty } = require('lodash/fp');

const buildInvitationUrl = ({ code, ticket }, { config }) => {
  const url = new URL(sprintf(config.inviteUrl, [code]));
  if (!isEmpty(ticket)) {
    url.searchParams.append('signup_url', encodeURI(ticket));
  }
  return url.toString();
};

module.exports = {
  buildInvitationUrl,
};
