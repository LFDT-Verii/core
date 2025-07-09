/**
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
 */

const fp = require('fastify-plugin');

const responseRequestId = (fastify, options, done) => {
  fastify.addHook('preSerialization', async (request, reply, payload) => {
    payload.requestId = request.id;
    return payload;
  });
  done();
};

module.exports = {
  responseRequestIdPlugin: fp(responseRequestId, {
    name: 'response-request-id-plugin',
  }),
};
