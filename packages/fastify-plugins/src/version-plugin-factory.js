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

const fp = require('fastify-plugin');

const fastifyVersionPluginFactory = (header, requestDecoration) => {
  const parseHeader = (req) => {
    const numberedVersion = Number(req.headers[header]);
    if (!Number.isNaN(numberedVersion)) {
      return numberedVersion;
    }
    return 0;
  };
  const versionPlugin = (fastify, opts, next) => {
    fastify.decorateRequest(requestDecoration, null);
    fastify.addHook('onRequest', async (req) => {
      req[requestDecoration] = parseHeader(req);
    });
    next();
  };
  return fp(versionPlugin);
};

module.exports = { fastifyVersionPluginFactory };
