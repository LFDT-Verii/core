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
const { flow, zip, range, map, forEach, castArray } = require('lodash/fp');
const { appendSearchParam } = require('@verii/common-functions');

const buildDeepLinkUrl = (
  requestUri,
  inspectorDid,
  issuerDid,
  vendorOriginContext,
  suffix,
  deepLinkProtocol,
) => {
  const requestUris = castArray(requestUri);
  const inspectorDids = castArray(inspectorDid);
  const issuerDids = castArray(issuerDid);
  const vendorOriginContexts = castArray(vendorOriginContext);
  const parsedLinks = flow(
    (items) => zip(items, range(0, items.length)),
    map(([value, index]) => ({
      _requestUri: value,
      _vendorOriginContext: vendorOriginContexts[index],
      _inspectorDid: inspectorDids[index],
      _issuerDid: issuerDids[index],
    })),
  )(requestUris);
  const url = new URL(`${deepLinkProtocol}${suffix}`);
  forEach(
    ({ _requestUri, _inspectorDid, _issuerDid, _vendorOriginContext }) => {
      flow(
        appendSearchParam('request_uri', _requestUri),
        appendSearchParam('inspectorDid', _inspectorDid),
        appendSearchParam('issuerDid', _issuerDid),
        appendSearchParam('vendorOriginContext', _vendorOriginContext),
      )(url);
    },
    parsedLinks,
  );
  return url;
};

module.exports = {
  buildDeepLinkUrl,
};
