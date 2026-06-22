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

const { flow } = require('lodash/fp');
const {
  appendSearchParam,
  appendSearchParamArray,
} = require('@verii/common-functions');
const { buildDeepLinkUrl } = require('./build-deep-link-url');

const buildIssuingDeepLink = (
  tenant,
  service,
  depot,
  credentialTypes,
  deepLinkProtocol,
) => {
  const credentialManifestUrl = flow(
    appendSearchParam('id', service._id.toString()),
    appendSearchParamArray('credential_types', credentialTypes),
  )(createPresentationRequestUrl('get-credential-manifest', tenant));

  return buildDeepLinkUrl(
    credentialManifestUrl,
    null,
    tenant.did,
    depot?.preauthCode != null
      ? `depot:${depot?._id}:${depot?.preauthCode}`
      : undefined,
    'issue',
    deepLinkProtocol,
  );
};

const createPresentationRequestUrl = (suffix, tenant) =>
  new URL(`${tenant.hostUrl}/vn-api/r/${encodeURI(tenant.did)}/${suffix}`);

module.exports = {
  buildIssuingDeepLink,
};
