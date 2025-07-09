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

const Ajv2019 = require('ajv/dist/2019');
const ajvFormats = require('ajv-formats');
const { forEach, keys } = require('lodash/fp');
const fp = require('fastify-plugin');
const draft7MetaSchema = require('ajv/dist/refs/json-schema-draft-07.json');
const { initValidation } = require('./validation');

const validationPlugin = (fastify, options, next) => {
  const ajvInstance = new Ajv2019(options.ajv);
  ajvInstance.addMetaSchema(draft7MetaSchema);
  ajvFormats(ajvInstance, fastify.config.ajvFormats);
  const validationFns = initValidation(ajvInstance);
  forEach((validationFnName) => {
    fastify.decorate(validationFnName, validationFns[validationFnName]);
  }, keys(validationFns));
  forEach((validationFnName) => {
    fastify.decorateRequest(validationFnName, validationFns[validationFnName]);
  }, options.decorateRequest ?? []);
  next();
};

module.exports = { validationPlugin: fp(validationPlugin) };
