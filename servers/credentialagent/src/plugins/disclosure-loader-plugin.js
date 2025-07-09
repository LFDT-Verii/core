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

const newError = require('http-errors');
const { isEmpty } = require('lodash/fp');
const fp = require('fastify-plugin');

const getDisclosureId = ({ exchange, params }) => {
  if (exchange?.disclosureId) {
    return exchange.disclosureId;
  }
  if (params.id) {
    return params.id;
  }
  return null;
};

const loadDisclosure = async (req) => {
  const disclosureId = getDisclosureId(req);
  if (disclosureId == null) {
    throw newError.BadRequest('No disclosureId sent by client');
  }
  const disclosure = await req.repos.disclosures.findById(disclosureId);
  if (isEmpty(disclosure)) {
    throw newError.NotFound(`Disclosure ${disclosureId} not found`);
  }

  return disclosure;
};

const disclosureLoaderPlugin = (fastify, options, next) => {
  fastify.decorateRequest('disclosure', null);
  fastify.addHook('preHandler', async (req) => {
    const disclosure = await loadDisclosure(req);
    req.disclosure = disclosure;
  });
  next();
};

module.exports = {
  disclosureLoaderPlugin: fp(disclosureLoaderPlugin),
  loadDisclosure,
};
