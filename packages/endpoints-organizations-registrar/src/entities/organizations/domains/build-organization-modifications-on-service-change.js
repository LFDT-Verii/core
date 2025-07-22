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

const { isEmpty, map, defaults, omit, xor } = require('lodash/fp');
const { categorizeServices } = require('@verii/organizations-registry');
const {
  selectActivatedServices,
} = require('../../organization-services/domains');
const { initPrepareProfileVc } = require('./prepare-profile-vc');

const initBuildOrganizationModificationsOnServiceChange = (fastify) => {
  const prepareProfileVc = initPrepareProfileVc(fastify);
  return async ({
    organization,
    services,
    activatedServiceIds,
    newOrganizationIds,
    authClients,
  }) => {
    const { didDoc, profile, ids } = organization;
    const modifications = {};

    if (newOrganizationIds != null) {
      modifications.ids = defaults(newOrganizationIds, ids);
    }

    if (authClients != null) {
      modifications.authClients = map(omit(['clientSecret']), authClients);
    }

    const activatedServices = selectActivatedServices(
      activatedServiceIds,
      services ?? organization.services
    );
    modifications.activatedServiceIds = map('id', activatedServices);

    const activatedServiceCategories = categorizeServices(activatedServices);
    if (!isPermissionsChanged(profile, activatedServiceCategories)) {
      return modifications;
    }

    modifications.profile = {
      ...profile,
      permittedVelocityServiceCategory: activatedServiceCategories,
    };

    const { jwtVc, credentialId, vcUrl } = await prepareProfileVc(
      didDoc,
      modifications.profile
    );

    modifications.signedProfileVcJwt = {
      signedCredential: jwtVc,
      credentialId,
    };
    modifications.verifiableCredentialJwt = vcUrl;

    return modifications;
  };
};

const isPermissionsChanged = (profile, newPermissions) =>
  profile.permittedVelocityServiceCategory == null ||
  !isEmpty(xor(profile.permittedVelocityServiceCategory, newPermissions));

module.exports = {
  initBuildOrganizationModificationsOnServiceChange,
};
