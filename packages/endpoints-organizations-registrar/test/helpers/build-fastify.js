const { createTestServer } = require('@verii/server-provider');
const {
  loadTestEnv,
  buildMongoConnection,
  testRegistrarSuperUser,
} = require('@verii/tests-helpers');
const path = require('path');

loadTestEnv(path.resolve(__dirname, '.env.test'));

const { flow, identity } = require('lodash/fp');
const { initServer } = require('../../src/init-server');
const { createConfig } = require('../../src/config/config');

const mongoConnection = buildMongoConnection('test-organization-registrar');

module.exports = (initializer = identity) =>
  flow(
    createTestServer,
    initServer,
    initializer
  )({
    ...createConfig(require('../../package.json')),
    mongoConnection,
    defaultOAuthUser: testRegistrarSuperUser,
});
