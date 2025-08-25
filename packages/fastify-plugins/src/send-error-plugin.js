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

const { initSendError } = require('@verii/error-aggregation');
const fp = require('fastify-plugin');

const sendErrorPlugin = async (fastify) => {
  const {
    config: { sentryDsn, enableProfiling, enableSentryDebug, nodeEnv, version },
  } = fastify;
  const { sendError, startProfiling, finishProfiling } = await initSendError({
    dsn: sentryDsn,
    enableProfiling,
    release: version,
    environment: nodeEnv,
    debug: enableSentryDebug,
  });
  fastify.decorate('sendError', sendError);
  fastify.decorateRequest('sendError', null);
  fastify.addHook('preHandler', async (req) => {
    req.sendError = sendError;
  });
  fastify.decorate('startProfiling', startProfiling);
  fastify.decorate('finishProfiling', finishProfiling);
  fastify.decorateRequest('profilingContext', null);
  fastify.addHook('onRequest', async (req) => {
    req.profilingContext = req.server.startProfiling({
      name: req.routeOptions.url,
      op: req.routeOptions.method,
      url: req.url,
    });
  });
  fastify.addHook('onResponse', async (req) => {
    req.server.finishProfiling(req.profilingContext);
  });
};

module.exports = {
  sendErrorPlugin: fp(sendErrorPlugin),
};
