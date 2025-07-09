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
const statuses = require('statuses');
const toIdentifier = require('toidentifier');

const autoSchemaPlugin = async (fastify, opts) => {
  const defaultOptions = {
    errorSchemaId: 'error',
    validationErrorCode: 400,
  };
  const options = { ...defaultOptions, ...(opts ?? {}) };

  if (fastify.getSchema(options.errorSchemaId) == null) {
    throw new Error(
      `autoSchemaPlugin requires a schema with id "${options.errorSchemaId}"`
    );
  }

  const hasTopLevelSecurity = options?.swagger?.security != null;

  const errorSchemaRef = { $ref: `${options.errorSchemaId}#` };

  for (const code of statuses.codes) {
    if (code < 400 || code > 599) {
      // eslint-disable-next-line no-continue
      continue;
    }

    fastify.decorate(`${toIdentifier(statuses.message[code])}Response`, {
      [code]: errorSchemaRef,
    });
  }

  fastify.decorate('currentAutoSchemaPreset', null);
  fastify.decorate('autoSchemaPreset', autoSchemaPreset);
  fastify.decorate('autoSchema', autoSchema);

  // autoSchemaPreset is not an arrow function to enable usage of `this`, which is bound to the calling fastify plugin's enacapsulated context
  function autoSchemaPreset(preset) {
    const updatedAutoSchemaPreset = {
      ...this.currentAutoSchemaPreset,
      ...preset,
    };

    if (Object.prototype.hasOwnProperty.call(this, 'currentAutoSchemaPreset')) {
      this.currentAutoSchemaPreset = updatedAutoSchemaPreset;
    } else {
      this.decorate('currentAutoSchemaPreset', updatedAutoSchemaPreset);
    }

    return this;
  }

  // autoSchema is an arrow function to enable usage of `this`, which is bound to the calling fastify plugin's enacapsulated context

  function autoSchema(baseSchema) {
    const schema = {
      ...this.currentAutoSchemaPreset,
      ...baseSchema,
    };

    schema.response = buildResponse(schema);

    return schema;
  }

  const buildResponse = (schema) => {
    const response = { ...schema.response, '5xx': errorSchemaRef };
    if (schema.body != null || schema.query != null) {
      response[options.validationErrorCode] = errorSchemaRef;
    }
    if (schema.params != null) {
      response[404] = errorSchemaRef;
    }
    if (hasTopLevelSecurity || schema.security != null) {
      response[401] = errorSchemaRef;
      response[403] = errorSchemaRef;
    }

    return response;
  };
};

module.exports = { autoSchemaPlugin: fp(autoSchemaPlugin) };
