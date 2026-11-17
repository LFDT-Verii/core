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

// The request as a signed JWT, or as unsigned JSON when asked for with ?format=json
const buildRequestResponseSchema = (prefix) => {
  const requestName = `${prefix}_request`;
  return {
    oneOf: [
      {
        type: 'object',
        properties: { [requestName]: { type: 'string' } },
        required: [requestName],
      },
      {
        type: 'object',
        properties: {
          [requestName]: {
            type: 'object',
            additionalProperties: true,
          },
        },
        required: [requestName],
      },
    ],
  };
};

module.exports = { buildRequestResponseSchema };
