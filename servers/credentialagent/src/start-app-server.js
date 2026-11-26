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

const {
  applyConfigOverrides,
  createServer,
  listenServer,
} = require('@verii/server-provider');
const { flow } = require('lodash/fp');
const { config, holderConfig, operatorConfig } = require('./config');
const { initServer } = require('./init-server');
const { initHolderServer } = require('./init-holder-server');
const { initOperatorServer } = require('./init-operator-server');

// configOverrides lets a server that embeds the agent change its config, as the Hub's createAppServer
// does, for example to describe its deployment its own way (describeDeployment). Its logRedactPaths
// are added to the agent's own.
const startAppServer = ({ configOverrides = {} } = {}) =>
  flow(
    createServer,
    initServer,
    listenServer,
  )(applyConfigOverrides(config, configOverrides));

const startHolderAppServer = ({ configOverrides = {} } = {}) =>
  flow(
    createServer,
    initHolderServer,
    listenServer,
  )(applyConfigOverrides(holderConfig, configOverrides));

const startOperatorAppServer = ({ configOverrides = {} } = {}) =>
  flow(
    createServer,
    initOperatorServer,
    listenServer,
  )(applyConfigOverrides(operatorConfig, configOverrides));

module.exports = {
  startAppServer,
  startHolderAppServer,
  startOperatorAppServer,
};
