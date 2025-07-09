module.exports = {
  invitationsRepoPlugin: require('./repo'),
  ...require('./domains'),
  ...require('./orchestrators'),
  ...require('./schemas'),
};
