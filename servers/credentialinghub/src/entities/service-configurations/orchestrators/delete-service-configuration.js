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

const { isEmpty, map } = require('lodash/fp');
const newError = require('http-errors');
const { ServiceConfigurationErrors } = require('../domain');

const deleteServiceConfiguration = (repoName) => async (serviceId, context) => {
  const { repos } = context;
  const depots = await repos.depots.findDepots(serviceId);
  if (!isEmpty(depots)) {
    throw newError(
      400,
      `Depot(s) ${map('_id')(
        depots,
      )} must be deleted before deleting service ${serviceId}`,
      {
        errorCode: ServiceConfigurationErrors.RELATED_DEPOT_UNDELETED,
      },
    );
  }
  return repos[repoName].delUsingFilter({
    filter: { _id: serviceId },
  });
};

module.exports = { deleteServiceConfiguration };
