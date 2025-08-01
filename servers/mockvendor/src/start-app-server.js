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

/* istanbul ignore next */
const { flow } = require('lodash/fp');
const { createServer, listenServer } = require('@verii/server-provider');
const { initServer } = require('./init-server');
const config = require('./config/config');

process.on('unhandledRejection', (error) => {
  console.error(error);
  process.exit(1);
});

const startAppServer = () =>
  flow(createServer, initServer, listenServer)(config);

module.exports = { startAppServer };
