/*
 * Copyright 2024 Velocity Team
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
const CredentialErrors = {
  REFERENCED_DEPOT_NOT_FOUND: 'referenced_depot_not_found',
  CREDENTIAL_TYPE_NOT_FOUND: 'credential_type_not_found',
  CREDENTIAL_TYPES_METADATA_UPSTREAM_ERROR:
    'credential_types_metadata_upstream_error',
  SCHEMA_UPSTREAM_ERROR: 'schema_upstream_error',
};

module.exports = { CredentialErrors };
