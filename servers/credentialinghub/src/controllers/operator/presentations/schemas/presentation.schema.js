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
const { mutableEntitySchema } = require('@verii/common-schemas');
const { basePresentationSchema } = require('./base-presentation.schema');

const presentationSchema = {
  $id: 'presentation',
  type: 'object',
  properties: {
    ...mutableEntitySchema.properties,
    ...basePresentationSchema.properties,
    depotId: {
      type: 'string',
      description: 'The depot associated with this user',
    },
    exchangeId: {
      type: 'string',
      description:
        "The exchangeId associated with this presentation's reception",
    },
    verifications: {
      type: 'array',
      items: {
        $ref: 'presentation-verification#',
      },
      default: [],
    },
  },
  required: [
    ...mutableEntitySchema.required,
    ...basePresentationSchema.required,
    'depotId',
    'exchangeId',
  ],
};

module.exports = {
  presentationSchema,
};
