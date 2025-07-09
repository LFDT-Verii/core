const { set } = require('lodash/fp');
const { mongoFactory, mongoClose } = require('@spencejs/spence-mongo-repos');
const { buildMongoConnection } = require('./build-mongo-connection');
const { loadTestEnv } = require('./load-test-env');

const mongoFactoryWrapper = async (dbName, context) => {
  const mongoConnection = buildMongoConnection(dbName);
  loadTestEnv();

  return mongoFactory(set('config.mongoConnection', mongoConnection, context));
};

module.exports = {
  mongoFactoryWrapper,
  mongoCloseWrapper: mongoClose,
};
