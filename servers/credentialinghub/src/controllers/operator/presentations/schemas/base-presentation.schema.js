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
const basePresentationSchema = {
  $id: 'base-presentation',
  title: 'base presentation',
  type: 'object',
  additionalProperties: false,
  required: ['format', 'presentation'],
  properties: {
    format: {
      enum: ['JWT_VP'],
      description: `the format of the data contained in the presentation
If the format is JWT_VP the presentation will be stored in a variable called presentation`,
    },
    presentation: {
      type: 'string',
      description: 'the presentation itself',
    },
    w3cPresentation: {
      $ref: 'w3c-presentation#',
    },
  },
};

module.exports = { basePresentationSchema };
