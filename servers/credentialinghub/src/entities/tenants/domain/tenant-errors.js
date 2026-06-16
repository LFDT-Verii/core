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

const TenantErrors = {
  DID_DOCUMENT_NOT_FOUND: 'did_document_not_found',
  ORG_PROFILE_NOT_FOUND: 'org_profile_not_found',
  KEY_PURPOSES_MUST_BE_UNIQUE: 'key_purposes_must_be_unique',
  KEY_KID_FRAGMENT_NOT_FOUND: 'key_kidFragment_not_found',
  TENANTS_MUST_BE_UNIQUE: 'tenant_must_be_unique',
  CAO_DID_REQUIRED: 'cao_did_required',
  RELATED_SERVICE_UNDELETED: 'related_service_undeleted',
  NAME_MUST_MATCH_PROFILE: 'name_must_match_profile',
  LOGO_MUST_MATCH_PROFILE: 'logo_must_match_profile',
};
module.exports = { TenantErrors };
