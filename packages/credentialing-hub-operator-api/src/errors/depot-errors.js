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
const DepotErrors = {
  REFERENCED_SERVICE_NOT_FOUND: 'referenced_service_not_found',
  RELATED_CREDENTIAL_UNDELETED: 'related_credential_undeleted',
  INVALID_AUTH_VALUES: 'invalid_auth_values',
  AUTH_VALUES_ALREADY_USED: 'auth_values_already_used',
  DEFERRED_CREDENTIALS_NOT_SUPPORTED: 'deferred_credentials_not_supported',
  DEPOT_NOT_FOUND: 'depot_not_found',
  FIND_BY_AUTH_VALUES_NOT_SUPPORTED: 'find_by_auth_values_not_supported',
};

module.exports = { DepotErrors };
