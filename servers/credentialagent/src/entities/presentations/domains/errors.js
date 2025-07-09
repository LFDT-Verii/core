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

const PresentationErrors = {
  INVALID_INTEGRATED_IDENTIFICATION_RULE:
    'Credential Agent only supports "pick" or "all" for "identityMatchers.rule"',
  PRESENTATION_JSON_PATH_MISSING: ({ path }) =>
    `Presentation doesnt contain value at ${path}`,
  CHECKS_FAILED: ({ reason, id }) =>
    `${reason}_credential_check_failed_credential_${id}`,
  PRESENTATION_PREAUTH_MUST_CONTAIN_VENDOR_ORIGIN_CONTEXT:
    'Presentation for a preauth disclosure must contain a vendorOriginContext',
};

module.exports = { PresentationErrors };
