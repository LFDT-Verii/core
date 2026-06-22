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
const ExchangeErrors = {
  REFERENCED_EXCHANGE_NOT_FOUND: 'referenced_exchange_not_found',
  REFERENCED_SERVICE_NOT_FOUND: 'referenced_service_not_found',
  REFERENCED_DEPOT_NOT_FOUND: 'referenced_depot_not_found',
  MESSAGING_SETTINGS_INVALID: 'messaging_settings_invalid',
  CREDENTIAL_OFFER_REQUEST_INVALID: 'credential_offer_request_invalid',
  UNAUTHORIZED: 'unauthorized',
  PRESENTATION_SUBMISSION_INVALID: 'presentation_submission_invalid',
  AUTHENTICATION_METHOD_UNSUPPORTED: 'authentication_method_unsupported',
};

module.exports = { ExchangeErrors };
