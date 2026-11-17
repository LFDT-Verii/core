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

const { forEach, keys } = require('lodash/fp');
const fp = require('fastify-plugin');
const { initAjv2019Validation } = require('./ajv2019-validation');

const validationPlugin = (fastify, options, next) => {
  const validationFns = initAjv2019Validation(
    options.ajv,
    fastify.config.ajvFormats,
  );
  forEach((validationFnName) => {
    fastify.decorate(validationFnName, validationFns[validationFnName]);
  }, keys(validationFns));
  forEach((validationFnName) => {
    fastify.decorateRequest(validationFnName, validationFns[validationFnName]);
  }, options.decorateRequest ?? []);
  next();
};

module.exports = { validationPlugin: fp(validationPlugin) };
