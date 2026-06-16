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
const { ObjectId } = require('mongodb');
const { isEmpty, map } = require('lodash/fp');
const newError = require('http-errors');
const { DepotErrors } = require('../domain');

const deleteDepot = async (depotId, serviceId, { repos }) => {
  const credentials = await repos.credentials.findByDepotId({ depotId });
  if (!isEmpty(credentials)) {
    throw newError(
      400,
      `Credentials(s) ${map('_id')(
        credentials,
      )} must be deleted before deleting depot ${depotId}`,
      {
        errorCode: DepotErrors.RELATED_CREDENTIAL_UNDELETED,
      },
    );
  }
  return repos.depots.delUsingFilter({
    filter: {
      _id: depotId,
      serviceId: new ObjectId(serviceId),
    },
  });
};

module.exports = { deleteDepot };
