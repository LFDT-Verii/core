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
const { isEmpty, find } = require('lodash/fp');
const newError = require('http-errors');
const { resolveDidWeb } = require('@verii/did-web');
const {
  serviceExists,
  toRelativeServiceId,
  updateServicesOnDidDoc,
} = require('@verii/did-doc');
const {
  buildPublicService,
  OrganizationServiceErrorMessages,
  buildOrganizationServiceForUpdate,
  validateService,
} = require('../domains');
const { loadCaoServiceRefs } = require('./load-cao-service-refs');

const updateService = async (did, serviceId, replacementService, context) => {
  const { repos } = context;
  const organization = await repos.organizations.findOneByDid(did);

  // TODO remove and replace with schema update
  if (!isEmpty(replacementService.id)) {
    throw newError.BadRequest(
      OrganizationServiceErrorMessages.SERVICE_ID_CANNOT_BE_UPDATED
    );
  }
  if (!isEmpty(replacementService.type)) {
    throw newError.BadRequest(
      OrganizationServiceErrorMessages.SERVICE_TYPE_CANNOT_BE_UPDATED
    );
  }

  const service = await updateOrganizationService(
    {
      organization,
      serviceId: `#${serviceId}`,
      updates: replacementService,
    },
    context
  );
  return buildPublicService(service);
};

const updateOrganizationService = async (
  { organization, serviceId, updates },
  context
) => {
  const { repos } = context;
  const didDocument = organization.didNotCustodied
    ? await resolveDidWeb(organization.didDoc.id)
    : organization.didDoc;

  // load and verify existing services from db and did document
  const existingDidDocService = serviceExists(didDocument, serviceId);
  const existingDbService = find(
    { id: toRelativeServiceId(serviceId) },
    organization.services
  );
  if (isEmpty(existingDidDocService) || isEmpty(existingDbService)) {
    throw new newError.NotFound(
      `Service ${serviceId} was not found in organization ${organization.didDoc.id}`
    );
  }

  const caoServiceRefs = await loadCaoServiceRefs([updates], context);

  const service = buildOrganizationServiceForUpdate(updates, existingDbService);
  validateService(service, caoServiceRefs, context);

  if (!organization.didNotCustodied) {
    await updateDidDoc(organization, service, context);
  }

  return repos.organizations.updateService(organization._id, service);
};

const updateDidDoc = async (organization, service, context) => {
  const { repos } = context;
  const { didDoc } = updateServicesOnDidDoc({
    didDoc: organization.didDoc,
    services: [service],
  });

  await repos.organizations.update(organization._id, { didDoc });
};

module.exports = { updateService };
