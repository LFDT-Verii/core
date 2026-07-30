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
const newError = require('http-errors');
const { isString, trim } = require('lodash/fp');
const { responseRequestIdPlugin } = require('@verii/fastify-plugins');
const { kmsPlugin } = require('../../entities/keys');
const {
  setDocumentationAudience,
} = require('../../documentation/set-documentation-audience');

const OPERATOR_CAO_DID_INVALID = 'operator_cao_did_invalid';

module.exports = async (fastify) => {
  setDocumentationAudience(fastify, 'operator');
  // This hook cascades to every core controller under /operator. Routes owned
  // by a custom provider and registered inside its plugin remain responsible
  // for their own authentication contract.
  fastify.addHook('onRequest', async (request, reply) => {
    await fastify.authenticateOperator(request, reply);
    const caoDid = request.operatorPrincipal?.caoDid;
    if (!reply.sent && (!isString(caoDid) || trim(caoDid) === '')) {
      throw newError(401, OPERATOR_CAO_DID_INVALID, {
        errorCode: OPERATOR_CAO_DID_INVALID,
      });
    }
  });
  fastify
    .register(kmsPlugin)
    .register(responseRequestIdPlugin)
    .autoSchemaPreset({ security: [{ operatorAuth: [] }] });
};
