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

const { errorSchema } = require('@verii/common-schemas');

// Fastify serializes an error through a wrapper object, so only declared
// properties reach the body. errors has to be declared to be returned.
const credentialItemsErrorSchema = {
  ...errorSchema,
  $id: 'credential-items-error',
  description:
    'error response that lists every invalid item. errorCode and message are those of the first error',
  properties: {
    ...errorSchema.properties,
    errors: {
      type: 'array',
      description:
        'one entry per problem, in item order. Only present when items fail the depot, credential type or credentialSubject checks',
      items: {
        type: 'object',
        properties: {
          index: {
            type: 'integer',
            description: 'the position of the item in items',
          },
          path: {
            type: 'string',
            description:
              'a JSON pointer to the invalid field in the request body, such as /items/3/credential/content/credentialSubject/name',
          },
          errorCode: {
            type: 'string',
          },
          message: {
            type: 'string',
          },
        },
        required: ['index', 'path', 'errorCode', 'message'],
      },
    },
  },
};

module.exports = credentialItemsErrorSchema;
