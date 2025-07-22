/*
 * Copyright 2024 Velocity Team
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

const ajvFormatsPlugin = require('ajv-formats');
const { loggerProvider } = require('@verii/logger');
const { nanoid } = require('nanoid');
const { customFastifyQueryStringParser } = require('@verii/rest-queries');
const Fastify = require('fastify');
const { FST_ERR_LOG_INVALID_LOGGER_CONFIG } = require('fastify/lib/errors');
const { initEvents } = require('@spencejs/spence-events');
const {
  immutableEntitySchema,
  mutableEntitySchema,
  errorSchema,
} = require('@verii/common-schemas');
const {
  errorsPlugin,
  cachePlugin,
  autoSchemaPlugin,
  sendErrorPlugin,
} = require('@verii/fastify-plugins');
const { bindRepo, mongodbPlugin } = require('@spencejs/spence-mongo-repos');
const { map } = require('lodash/fp');
const { idKeyMapper } = require('@verii/common-functions');
const fastifySwagger = require('@fastify/swagger');
const fastifySwaggerUI = require('@fastify/swagger-ui');

const commonCreateServer = (config, log) => {
  const { customFastifyOptions, traceIdHeader } = config;

  const fastifyOptions = {
    maxParamLength: 2000,
    caseSensitive: false,
    keepAliveTimeout: 65000,
    genReqId: () => nanoid(10),
    ignoreTrailingSlash: true,
    trustProxy: true,
    ...customFastifyOptions,
    querystringParser: customFastifyQueryStringParser,
    ...buildAjvOptions(config),
    ...buildHttpOptions(config),
  };

  if (FST_ERR_LOG_INVALID_LOGGER_CONFIG == null) {
    fastifyOptions.logger = log;
  } else {
    fastifyOptions.loggerInstance = log;
  }

  const server = Fastify(fastifyOptions);

  initEvents({
    log,
    errorHandler: (event, context, error) => {
      log.error({ context, event }, 'Error Context');
      log.error(error);
    },
  });

  return (
    server
      // schemas
      .addSchema(immutableEntitySchema)
      .addSchema(mutableEntitySchema)
      .register(autoSchemaPlugin)
      // serialization rules
      .addHook('preSerialization', async (req, reply, payload) => {
        if (payload == null) {
          return null;
        }

        if (Array.isArray(payload)) {
          return map(idKeyMapper, payload);
        }

        return idKeyMapper(payload);
      })
      // config
      .decorate('config', config)
      .decorateRequest('config', null)
      // error handling
      .addSchema(errorSchema)
      .register(errorsPlugin)
      .register(sendErrorPlugin)
      // traceIds & logging
      .decorateRequest('traceId', null)
      .addHook('preParsing', async (req) => {
        req.traceId = req.headers[traceIdHeader] || `!${req.id}`;
        req.log = req.log.child({
          traceId: req.traceId,
        });
      })
      .addHook('onRoute', (opts) => {
        if (opts.path === '/') {
          opts.logLevel = 'silent';
        }
      })
      .addHook('onError', async (req, reply, error) => {
        const { body } = req;

        if (error.validation) {
          req.log.warn(
            { req: req.raw, body, res: reply.raw, err: error },
            error && error.message
          );
        } else {
          req.log.error(
            { req: req.raw, body, res: reply.raw, err: error },
            error && error.message
          );
        }
      })
      // request cache
      .register(cachePlugin)
      // database connection
      .register(mongodbPlugin)
      .decorateRequest('repos', null)
      .addHook('preValidation', async (req) => {
        req.repos = bindRepo(req);
      })
      // swagger configuration
      .register(fastifySwagger, {
        openapi: config.swaggerInfo,
        exposeRoute: true,
      })
      .register(fastifySwaggerUI, {
        uiConfig: {
          deepLinking: true,
        },
        initOAuth: {},
      })
  );
};

const buildAjvOptions = (config) => {
  return {
    ajv: {
      customOptions: config.ajvOptions,
      plugins: [[ajvFormatsPlugin, config.ajvFormats]],
    },
  };
};

const buildHttpOptions = (config) => {
  const { enableHttp2, serverCertificate, serverCertificateKey } = config;
  const isSSLMode = !!serverCertificate && !!serverCertificateKey;
  const opts = {};
  if (isSSLMode) {
    opts.https = {
      key: serverCertificateKey,
      cert: serverCertificate,
    };
    if (enableHttp2) {
      opts.https.allowHTTP1 = true;
    }
  }
  if (enableHttp2) {
    opts.http2 = true;
  }
  return opts;
};

const createCommonLog = (config) => {
  const { nodeEnv, logSeverity, version } = config;
  return loggerProvider({ nodeEnv, logSeverity, version });
};

module.exports = { commonCreateServer, createCommonLog };
