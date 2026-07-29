/**
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
 */

const { createServer, listenServer } = require('@verii/server-provider');
const { buildConfig } = require('./config');
const { createSwaggerConfig } = require('./config/swagger-config');
const { initServer } = require('./init-server');
const {
  startEmbeddedNotificationWorker,
} = require('./start-embedded-notification-worker');
const {
  resolveCaoSecurityProvider,
} = require('./plugins/cao-security-provider');

const createAppServer = ({
  caoSecurityProvider,
  configOverrides = {},
} = {}) => {
  const resolvedCaoSecurityProvider =
    resolveCaoSecurityProvider(caoSecurityProvider);
  const baseConfig = {
    ...buildConfig(),
    ...configOverrides,
  };
  const serverConfig = {
    ...baseConfig,
    ...createSwaggerConfig(
      baseConfig.version,
      resolvedCaoSecurityProvider.documentation,
    ),
  };
  const server = createServer(serverConfig);
  return initServer(server, {
    caoSecurityProvider: resolvedCaoSecurityProvider,
  });
};

const startAppServer = (options = {}) => {
  const server = createAppServer(options);
  startEmbeddedNotificationWorker(server);
  listenServer(server);
  return server;
};

module.exports = {
  createAppServer,
  startAppServer,
};
