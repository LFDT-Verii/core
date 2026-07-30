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
const { w3cVcSchema } = require('@verii/common-schemas');

const disclosedTypeSchema = {
  oneOf: [
    {
      type: 'string',
    },
    {
      type: 'array',
      items: {
        type: 'string',
      },
      minItems: 1,
    },
  ],
};

const disclosedW3cVcSchema = {
  ...w3cVcSchema,
  $id: 'disclosed-w3c-vc',
  properties: {
    ...w3cVcSchema.properties,
    type: {
      ...disclosedTypeSchema,
      description: w3cVcSchema.properties.type.description,
    },
  },
};

module.exports = {
  disclosedTypeSchema,
  disclosedW3cVcSchema,
};
