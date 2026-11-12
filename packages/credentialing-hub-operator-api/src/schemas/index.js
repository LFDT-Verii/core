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

const newIssuerServiceSchema = require('./new-issuer-service.schema');
const issuerServiceSchema = require('./issuer-service.schema');
const newDepotSchema = require('./new-depot.schema.json');
const depotSchema = require('./depot.schema');
const depotConflictErrorSchema = require('./depot-conflict-error.schema');
const findDepotsByAuthValuesRequestSchema = require('./find-depots-by-auth-values-request.schema.json');
const findDepotsByAuthValuesResponseSchema = require('./find-depots-by-auth-values-response.schema.json');
const newCredentialSchema = require('./new-credential.schema.json');
const credentialSchema = require('./credential.schema');

module.exports = {
  credentialSchema,
  depotConflictErrorSchema,
  depotSchema,
  findDepotsByAuthValuesRequestSchema,
  findDepotsByAuthValuesResponseSchema,
  issuerServiceSchema,
  newCredentialSchema,
  newDepotSchema,
  newIssuerServiceSchema,
};
