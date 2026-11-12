/*
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
 *
 */

const { OBJECT_ID_PATTERN } = require('./object-id-pattern');

const objectIdSchema = {
  type: 'string',
  pattern: OBJECT_ID_PATTERN,
};

const authValueSchema = {
  anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
};

// One depot's auth values, as depots/create takes them
const authValuesTupleSchema = {
  type: 'array',
  minItems: 1,
  maxItems: 10,
  items: authValueSchema,
};

// authValues requires serviceId. OpenAPI 3.0.3 has no dependentRequired, so
// this says it with anyOf, not and required.
const serviceIdRequiredByAuthValues = [
  { not: { required: ['authValues'] } },
  { required: ['serviceId'] },
];

const findDepotsRequestSchema = {
  $id: 'find-depots-request',
  type: 'object',
  title: 'Find depots',
  description:
    // eslint-disable-next-line max-len
    'Payload schema for finding depots. The filters combine with AND, and mean what they mean in the depots/get query. authValues requires the serviceId of an internal verifiable_presentation issuer service',
  additionalProperties: false,
  properties: {
    tenantId: {
      type: 'string',
    },
    serviceId: objectIdSchema,
    depotId: {
      anyOf: [objectIdSchema, { type: 'array', items: objectIdSchema }],
    },
    authValues: {
      type: 'array',
      description:
        // eslint-disable-next-line max-len
        "Finds the depots whose auth values equal any of these. Each item holds one depot's auth values, as depots/create takes them: one value per auth rule, in valueIndex order. They match as authentication matches them: strings trimmed and lower-cased, numbers and booleans unchanged. Only depots created under the service's current auth rules match",
      minItems: 1,
      maxItems: 1000,
      items: authValuesTupleSchema,
    },
  },
  required: ['tenantId'],
  anyOf: serviceIdRequiredByAuthValues,
};

module.exports = findDepotsRequestSchema;
