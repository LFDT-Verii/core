/*
 * Copyright 2025 Velocity Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
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

const mongoConnection = buildMongoConnection('test-credential-type-registrar');

module.exports = (initializer = identity) =>
  flow(
    createTestServer,
    initServer,
    initializer,
  )({
    ...createConfig(require('../../package.json')),
    mongoConnection,
    defaultOAuthUser: testRegistrarSuperUser,
  });
