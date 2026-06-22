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

const buildOpenid4vpAuthorizationRequestLink = (tenant, requestId) => {
  const requestUri = buildOpenid4vpAuthorizationRequestUri(tenant, requestId);
  const protocolLinkUrl = new URL('openid4vp://authorize');
  protocolLinkUrl.searchParams.append(
    'client_id',
    `decentralized_identifier:${tenant.did}`,
  );
  protocolLinkUrl.searchParams.append('request_uri', requestUri);
  protocolLinkUrl.searchParams.append('request_uri_method', 'post');
  return { protocolLink: protocolLinkUrl.href, requestUri };
};

const buildOpenid4vpAuthorizationRequestUri = (tenant, requestId) =>
  `${tenant.hostUrl}/r/${tenant._id}/openid4vp/authorization-request/${requestId}`;

module.exports = {
  buildOpenid4vpAuthorizationRequestLink,
  buildOpenid4vpAuthorizationRequestUri,
};
