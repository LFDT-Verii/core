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

const { getOrganizationVerifiedProfile } = require('@verii/common-fetchers');
const newError = require('http-errors');
const { TenantErrors } = require('../domain/tenant-errors');

const loadTenantProfile = async (did, context) => {
  const orgProfile = await resolveOrgVcWithErrorHandling(
    did,
    TenantErrors.ORG_PROFILE_NOT_FOUND,
    context,
  );
  return orgProfile.credentialSubject;
};

const resolveOrgVcWithErrorHandling = async (did, errorCode, context) => {
  try {
    return await getOrganizationVerifiedProfile(did, context);
  } catch (error) {
    context.log.error(error, 'Error retrieving organization profile');
    throw newError(400, errorCode, { errorCode });
  }
};

module.exports = { loadTenantProfile };
