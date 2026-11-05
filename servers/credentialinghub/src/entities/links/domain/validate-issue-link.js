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
const { LinkErrors } = require('./link-errors');
const {
  isInternalVpAuth,
} = require('../../issuer-services/domain/is-internal-vp-auth');
const { isPreauthCodeAuth } = require('./is-preauth-code-auth');

const validateIssueLink = (service, depotId, depot) => {
  if (service == null) {
    throw newError(400, LinkErrors.referenced_service_not_found, {
      errorCode: LinkErrors.referenced_service_not_found,
    });
  }
  if (depotId != null && depot == null) {
    throw newError(400, LinkErrors.referenced_depot_not_found, {
      errorCode: LinkErrors.referenced_depot_not_found,
    });
  }
  if (depot == null && requiresDepot(service)) {
    throw newError(400, LinkErrors.issue_link_requires_depotId, {
      errorCode: LinkErrors.issue_link_requires_depotId,
    });
  }
};

// A service that can authenticate holders by presentation can use a shared
// link, so only a preauth-only service needs a depot.
const requiresDepot = (service) =>
  isPreauthCodeAuth(service) && !isInternalVpAuth(service);

module.exports = { validateIssueLink };
