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
 */

const exchangeSchema = {
  $id: 'operator-exchange',
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'serviceId',
    'type',
    'protocol',
    'state',
    'events',
    'credentialIds',
    'presentationIds',
    'createdAt',
  ],
  properties: {
    id: { type: 'string' },
    depotId: { type: 'string' },
    serviceId: { type: 'string' },
    type: { type: 'string', enum: ['issuer', 'relying_party'] },
    protocol: { type: 'string' },
    state: { type: 'string' },
    events: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['state', 'timestamp'],
        properties: {
          state: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    },
    error: {
      type: 'object',
      additionalProperties: false,
      required: ['code', 'message'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    credentialIds: { type: 'array', items: { type: 'string' } },
    presentationIds: { type: 'array', items: { type: 'string' } },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

module.exports = { exchangeSchema };
