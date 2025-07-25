/**
 * Copyright 2023 Velocity Team
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
 */

const { createTestServer } = require('@verii/server-provider');
const { loadTestEnv, buildMongoConnection } = require('@verii/tests-helpers');

loadTestEnv();

const { flow } = require('lodash/fp');
const { operatorConfig } = require('../../../src/config');
const { initOperatorServer } = require('../../../src/init-operator-server');

const mongoConnection = buildMongoConnection('test-credential-agent');

module.exports = (overrideConfig = {}) =>
  flow(
    createTestServer,
    initOperatorServer
  )({ ...operatorConfig, ...overrideConfig, mongoConnection });
