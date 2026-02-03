/**
 * Copyright 2023 Velocity Team
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
 */

const { flow, includes } = require('lodash/fp');
const {
  appendSearchParamArray,
  appendSearchParam,
} = require('@verii/common-functions');
const { VendorEndpointCategory } = require('../../disclosures');

const createPresentationRequestUrl = (
  suffix,
  { tenant, config: { hostUrl } },
) => new URL(`${hostUrl}/api/holder/v0.6/org/${tenant.did}/${suffix}`);

const createDeepLinkUrl = (suffix, { config: { deepLinkProtocol } }) =>
  new URL(`${deepLinkProtocol}${suffix}`);

const buildDisclosureRequestDeepLink = (
  disclosure,
  vendorOriginContext,
  context,
) => {
  if (includes(disclosure.vendorEndpoint, VendorEndpointCategory.ISSUING)) {
    return buildIssuingDeepLink(
      disclosure._id,
      null,
      null,
      vendorOriginContext,
      context,
    );
  }

  return buildPresentationRequestDeepLink(
    disclosure._id,
    vendorOriginContext,
    context,
  );
};

const buildPresentationRequestDeepLink = (
  disclosureId,
  vendorOriginContext,
  context,
) => {
  const presentationRequestUrl = flow(appendSearchParam('id', disclosureId))(
    createPresentationRequestUrl('inspect/get-presentation-request', context),
  );

  const deepLink = generateDeepLink(
    {
      requestUri: presentationRequestUrl.href,
      vendorOriginContext,
      inspectorDid: context.tenant.did,
    },
    'inspect',
    context,
  );

  return deepLink.toString();
};

const buildIssuingDeepLink = (
  disclosureId,
  exchangeId,
  types,
  vendorOriginContext,
  context,
) => {
  const credentialManifestUrl = flow(
    appendSearchParam('id', disclosureId),
    appendSearchParam('exchange_id', exchangeId),
    appendSearchParamArray('credential_types', types),
  )(createPresentationRequestUrl('issue/get-credential-manifest', context));

  const deepLink = generateDeepLink(
    {
      requestUri: credentialManifestUrl.href,
      vendorOriginContext,
      issuerDid: context.tenant.did,
    },
    'issue',
    context,
  );

  return deepLink.toString();
};

const generateDeepLink = (
  { requestUri, vendorOriginContext, inspectorDid, issuerDid },
  type,
  context,
) =>
  flow(
    appendSearchParam('request_uri', requestUri),
    appendSearchParam('inspectorDid', inspectorDid),
    appendSearchParam('issuerDid', issuerDid),
    appendSearchParam('vendorOriginContext', vendorOriginContext),
  )(createDeepLinkUrl(type, context));

module.exports = {
  buildIssuingDeepLink,
  buildPresentationRequestDeepLink,
  buildDisclosureRequestDeepLink,
  generateDeepLink,
  createDeepLinkUrl,
};
