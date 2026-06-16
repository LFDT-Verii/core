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
const newError = require('http-errors');
const { find } = require('lodash/fp');
const { TenantErrors } = require('./tenant-errors');

const validateNewTenant = (newTenant, orgProfile, context) => {
  if (newTenant.caoDid == null && context.config.defaultCaoDid == null) {
    throw newError(400, TenantErrors.CAO_DID_REQUIRED, {
      errorCode: TenantErrors.CAO_DID_REQUIRED,
    });
  }
  validateNameAndLogo(newTenant, orgProfile);
};

const validateNameAndLogo = (newTenant, orgProfile) => {
  if (
    newTenant.name !== orgProfile.name &&
    !find({ name: newTenant.name }, orgProfile.commercialEntities)
  ) {
    throw newError(400, TenantErrors.NAME_MUST_MATCH_PROFILE, {
      errorCode: TenantErrors.NAME_MUST_MATCH_PROFILE,
    });
  }
  if (
    newTenant.logo !== orgProfile.logo &&
    !find({ logo: newTenant.logo }, orgProfile.commercialEntities)
  ) {
    throw newError(400, TenantErrors.LOGO_MUST_MATCH_PROFILE, {
      errorCode: TenantErrors.LOGO_MUST_MATCH_PROFILE,
    });
  }
};

module.exports = { validateNewTenant };
