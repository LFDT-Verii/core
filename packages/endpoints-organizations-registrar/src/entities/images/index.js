module.exports = {
  imageRepoPlugin: require('./repo'),
  ...require('./domain'),
  ...require('./schema'),
};
