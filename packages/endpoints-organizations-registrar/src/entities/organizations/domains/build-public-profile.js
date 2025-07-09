const { omit } = require('lodash/fp');
const { PublicProfileFieldsForHide } = require('./constants');

const buildPublicProfile = (verifiedProfile) =>
  omit(PublicProfileFieldsForHide, verifiedProfile);

module.exports = {
  buildPublicProfile,
};
