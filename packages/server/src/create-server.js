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

const fastifyHelmet = require('@fastify/helmet');
const fastifySensible = require('@fastify/sensible');

const {
  commonCreateServer,
  createCommonLog,
} = require('./common-create-server');

const createServer = (config) => {
  const log = createCommonLog(config);
  log.info(config, 'Server Configured');

  const server = commonCreateServer(config, log);

  return (
    server
      // config
      .addHook('onRequest', async (req) => {
        req.config = server.config;
      })
      // logging
      .addHook('preValidation', async (req) => {
        if (req.body) {
          req.log.debug({ headers: req.headers, body: req.body }, 'request');
        }
      })
      .addHook('preSerialization', async (req, reply, payload) => {
        if (payload) {
          req.log.debug({ body: payload }, 'response body');
        }
        return payload;
      })
      // security
      .register(fastifySensible)
      .register(fastifyHelmet, (instance) => ({
        contentSecurityPolicy: {
          directives: {
            ...fastifyHelmet.contentSecurityPolicy.getDefaultDirectives(),
            'form-action': ["'self'"],
            'img-src': ["'self'", 'data:', 'validator.swagger.io'],
            'script-src': ["'self'"].concat(instance.swaggerCSP.script),
            'style-src': ["'self'", 'https:'].concat(instance.swaggerCSP.style),
          },
        },
      }))
  );
};

const listenServer = (server) => {
  const { appPort, appHost } = server.config;
  server.listen({ port: appPort, host: appHost }, (err) => {
    if (err) {
      /* istanbul ignore next */
      server.log.error(err);
      setTimeout(() => process.exit(1), 5000); // let errors printout
      return;
    }
    server.log.info('Server Started');
  });
};

module.exports = {
  createServer,
  listenServer,
};
