const { createTestServer } = require('@verii/server-provider');
const { loadTestEnv, buildMongoConnection } = require('@verii/tests-helpers');

loadTestEnv();

const mongoConnection = buildMongoConnection('test-mockvendor');
const { flow } = require('lodash/fp');
const config = require('../../src/config/config');
const { initServer } = require('../../src/init-server');

module.exports = () =>
  flow(
    createTestServer,
    initServer,
  )({
    ...config,
    mongoConnection,
  });
