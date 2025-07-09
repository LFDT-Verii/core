/*
 * Copyright 2025 Velocity Team
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

const { values } = require('lodash/fp');

const { ConsentTypes } = require('../../../entities');

const consentResponseSchema = {
  $id: 'https://velocitynetwork.foundation/registrar-schemas/consent-response.schema.json',
  title: 'consent-response-schema',
  description: 'consent response api for GET and POST',
  type: 'object',
  properties: {
    id: { type: 'string' },
    type: {
      type: 'string',
      enum: values(ConsentTypes),
    },
    version: { type: 'string' },
    userId: { type: 'string' },
    organizationId: { type: 'string' },
    serviceId: { type: 'string' },
    createdAt: {
      type: 'string',
      format: 'date-time',
    },
  },
  required: ['id', 'type', 'version', 'userId', 'createdAt'],
};

module.exports = { consentResponseSchema };
