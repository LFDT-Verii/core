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
// properties reach the body. depotId has to be declared to be returned.
const depotConflictErrorSchema = {
  ...errorSchema,
  $id: 'depot-conflict-error',
  description: 'error response when the depot conflicts with an existing one',
  properties: {
    ...errorSchema.properties,
    depotId: {
      type: 'string',
      description: 'the id of the existing depot',
    },
  },
};

module.exports = depotConflictErrorSchema;
