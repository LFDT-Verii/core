module.exports = {
  ...require('./src/admin-jwt-auth'),
  ...require('./src/oauth'),
  ...require('./src/basic-auth'),
};
