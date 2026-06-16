/*
 * Copyright 2026 Velocity Team
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

const { appendSearchParam } = require('@verii/common-functions');
const { buildDeepLinkUrl } = require('./build-deep-link-url');

const buildPresentationDeepLink = (
  tenant,
  service,
  depot,
  deepLinkProtocol,
) => {
  const presentationRequestUrl = appendSearchParam(
    'id',
    service._id,
  )(createPresentationRequestUrl(tenant));

  return buildDeepLinkUrl(
    presentationRequestUrl,
    tenant.did,
    null,
    depot?._id != null ? `depot:${depot._id}` : undefined,
    'inspect',
    deepLinkProtocol,
  );
};

const createPresentationRequestUrl = (tenant) =>
  new URL(
    `${tenant.hostUrl}/vn-api/r/${encodeURI(tenant.did)}/get-presentation-request`,
  );

module.exports = {
  buildPresentationDeepLink,
};
