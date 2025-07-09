module.exports = {
  ...require('./validate-group'),
  ...require('./validate-group-by-user'),
  ...require('./find-group-or-error'),
  ...require('./validate-did'),
};
