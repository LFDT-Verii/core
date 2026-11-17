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

const { castArray, flow, forEach, reduce } = require('lodash/fp');

const appendSearchParam = (key, value) => (url) => {
  if (value != null) {
    url.searchParams.append(key, value);
  }
  return url;
};

const appendSearchParamArray = (key, array) => (url) => {
  forEach((value) => {
    url.searchParams.append(key, value);
  }, array);

  return url;
};

const buildAgentHolderUrl = (hostUrl, did, suffix) =>
  new URL(`${hostUrl}/api/holder/v0.6/org/${did}/${suffix}`);

const appendDeepLinkSearchParams = (
  url,
  { requestUri, inspectorDid, issuerDid, vendorOriginContext },
) =>
  flow(
    appendSearchParam('request_uri', requestUri),
    appendSearchParam('inspectorDid', inspectorDid),
    appendSearchParam('issuerDid', issuerDid),
    appendSearchParam('vendorOriginContext', vendorOriginContext),
  )(url);

const buildDeepLink = (deepLinkProtocol, type, links) =>
  reduce(
    appendDeepLinkSearchParams,
    new URL(`${deepLinkProtocol}${type}`),
    castArray(links),
  );

module.exports = {
  appendSearchParamArray,
  appendSearchParam,
  buildAgentHolderUrl,
  buildDeepLink,
};
