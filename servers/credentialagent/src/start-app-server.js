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

const { createServer, listenServer } = require('@verii/server-provider');
const { flow } = require('lodash/fp');
const { config, holderConfig, operatorConfig } = require('./config');
const { initServer } = require('./init-server');
const { initHolderServer } = require('./init-holder-server');
const { initOperatorServer } = require('./init-operator-server');

const startAppServer = () =>
  flow(createServer, initServer, listenServer)(config);

const startHolderAppServer = () =>
  flow(createServer, initHolderServer, listenServer)(holderConfig);

const startOperatorAppServer = () =>
  flow(createServer, initOperatorServer, listenServer)(operatorConfig);

module.exports = {
  startAppServer,
  startHolderAppServer,
  startOperatorAppServer,
};
