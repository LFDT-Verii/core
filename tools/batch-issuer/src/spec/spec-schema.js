/**
 * Copyright 2026 Velocity Team
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

const { get } = require('lodash/fp');
const { newDepotSchema } = require('@verii/credentialing-hub-operator-api');
const { VALUE_TYPES } = require('../values/convert-value');

const nonEmptyString = { type: 'string', minLength: 1 };

const authValueSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['column'],
  properties: {
    column: {
      ...nonEmptyString,
      description: 'the CSV column that holds the value',
    },
  },
};

const depotSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['userReference'],
  properties: {
    userReference: {
      ...nonEmptyString,
      description: "a Handlebars template of the depot's userReference",
    },
    authValues: {
      type: 'array',
      description:
        "one entry for each of the service's auth rules, in valueIndex order",
      maxItems: get(['properties', 'authValues', 'maxItems'], newDepotSchema),
      items: authValueSchema,
    },
    expectedCredentialTypes: get(
      ['properties', 'expectedCredentialTypes'],
      newDepotSchema,
    ),
    deferredCredentials: { type: 'boolean' },
  },
};

const credentialSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['template', 'credentialReference'],
  properties: {
    template: {
      ...nonEmptyString,
      description:
        "a JSON template of the credential's content, relative to the spec",
    },
    credentialReference: {
      ...nonEmptyString,
      description:
        "a Handlebars template of the credential's credentialReference",
    },
    tags: {
      type: 'array',
      description: 'Handlebars templates of the tags',
      items: nonEmptyString,
    },
  },
};

/**
 * The JSON schema of a batch-issuer spec file.
 */
const specSchema = {
  $id: 'batch-issuer-spec',
  type: 'object',
  additionalProperties: false,
  required: ['tenantId', 'serviceId', 'depot'],
  properties: {
    tenantId: nonEmptyString,
    serviceId: nonEmptyString,
    depot: depotSchema,
    columns: {
      type: 'object',
      description: 'the type of each typed column. Other columns are strings',
      additionalProperties: { enum: VALUE_TYPES },
    },
    credentials: {
      type: 'array',
      description:
        'the credentials of each row. Without them, the load creates depots only',
      minItems: 1,
      items: credentialSchema,
    },
  },
};

module.exports = { specSchema };
