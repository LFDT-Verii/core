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
const { find } = require('lodash/fp');
const newError = require('http-errors');
const {
  buildPublicService,
  OrganizationServiceErrorMessages,
} = require('../domains');

const getService = async (did, serviceId, context) => {
  const { repos } = context;
  const organization = await repos.organizations.findOneByDid(did);
  const service = find({ id: `#${serviceId}` }, organization.services);
  if (service == null) {
    throw newError.NotFound(
      OrganizationServiceErrorMessages.ORGANIZATION_SERVICE_NOT_FOUND
    );
  }
  return buildPublicService(service);
};

module.exports = { getService };
