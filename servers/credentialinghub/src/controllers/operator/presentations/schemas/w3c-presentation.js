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
const w3cPresentationSchema = {
  title: 'w3c presentation',
  $id: 'w3c-presentation',
  type: 'object',
  additionalProperties: true,
  properties: {
    id: {
      type: 'string',
    },
    type: {
      type: 'array',
      description: 'The JSON-LD type of the credential.',
      items: {
        type: 'string',
      },
      minItems: 1,
    },
    verifiableCredential: {
      type: 'array',
      items: {
        oneOf: [
          {
            $ref: 'https://velocitycareerlabs.io/w3c-vc.schema.json',
          },
          {
            type: 'string',
          },
        ],
      },
    },
  },
};

module.exports = {
  w3cPresentationSchema,
};
