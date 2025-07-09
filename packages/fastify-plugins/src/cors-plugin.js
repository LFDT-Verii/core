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

const { concat, compact, flow } = require('lodash/fp');
const fastifyCors = require('@fastify/cors');
const fp = require('fastify-plugin');

const corsPlugin = (fastify, options, next) => {
  const wildcardRoutes = options.wildcardRoutes ?? [];
  const allowedCorsOrigins = flow(
    concat([
      fastify.config.tokenWalletBaseUrl,
      fastify.config.registrarAppUiUrl,
    ]),
    compact
  )(fastify.config.allowedCorsOrigins);
  const allowedHeaders = [
    'Authorization',
    'Accept',
    'Origin',
    'Keep-Alive',
    'User-Agent',
    'Cache-Control',
    'Content-Type',
    'Content-Range',
    'Range',
    'x-auto-activate',
    'x-vnf-protocol-version',
  ];
  const allowedMethods = ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE', 'PATCH'];
  const optionsObj = {
    allowedHeaders,
    methods: allowedMethods,
  };
  fastify.register(fastifyCors, () => {
    return (req, cb) => {
      if (wildcardRoutes.includes(req.routeOptions.url)) {
        return cb(null, {
          ...optionsObj,
          origin: '*',
        });
      }
      return cb(null, {
        ...optionsObj,
        origin: allowedCorsOrigins,
      });
    };
  });
  next();
};

module.exports = { corsPlugin: fp(corsPlugin) };
