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

const path = require('node:path');
const fastifyAutoload = require('@fastify/autoload');
const { httpClientPlugin } = require('@verii/fastify-plugins');
const {
  rpcProviderPlugin,
  authenticateVnfClientPlugin,
} = require('@verii/base-contract-io');
const { pick } = require('lodash/fp');
const { openid4vciPlugin } = require('./entities/openid4vci');
const { openid4vpPlugin } = require('./entities/openid4vp');
const {
  notificationEnqueueAdapterPlugin,
} = require('./entities/notifications');

const initServer = (server) => {
  if (!server.config.isTest) {
    server.register(authenticateVnfClientPlugin);
  }

  return server
    .register(rpcProviderPlugin)
    .register(notificationEnqueueAdapterPlugin)
    .register(fastifyAutoload, {
      dir: path.join(__dirname, 'controllers'),
      autoHooks: true,
      cascadeHooks: true,
      dirNameRoutePrefix: (folderParent, folderName) => {
        if (['openid4vc', 'openid4vp'].includes(folderName)) {
          return false;
        }
        return folderName;
      },
    })
    .register(fastifyAutoload, {
      dir: `${__dirname}/entities`,
      indexPattern: /.*dont-match-indexes(\.ts|\.js|\.cjs|\.mjs)$/,
      scriptPattern: /.*repo(\.ts|\.js|\.cjs|\.mjs)$/,
    })
    .register(httpClientPlugin, {
      name: 'fetch',
      options: {
        ...pick(
          [
            'nodeEnv',
            'requestTimeout',
            'traceIdHeader',
            'tlsRejectUnauthorized',
            'isTest',
          ],
          server.config,
        ),
      },
    })
    .register(httpClientPlugin, {
      name: 'registrarFetch',
      options: {
        ...pick(
          [
            'nodeEnv',
            'requestTimeout',
            'traceIdHeader',
            'tlsRejectUnauthorized',
            'isTest',
          ],
          server.config,
        ),
        prefixUrl: server.config.registrarUrl,
      },
    })
    .register(openid4vciPlugin)
    .register(openid4vpPlugin);
};

module.exports = { initServer };
