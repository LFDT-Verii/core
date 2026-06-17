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

const { flatMap, flow, isEmpty, omit, uniq } = require('lodash/fp');
const { optional } = require('@verii/common-functions');
const {
  OPENID4VP_DEPOT_REQUEST_PREFIX,
  OPENID4VP_SERVICE_REQUEST_PREFIX,
} = require('../../openid4vp/domain/openid4vp-request-id');
const {
  buildCredentialOfferLink,
  buildIssuingDeepLink,
  buildOpenid4vpAuthorizationRequestLink,
  buildPresentationDeepLink,
  buildRedirectUrl,
  isPreauthCodeAuth,
  validateIssueLink,
  validatePresentationLink,
} = require('../domain');

// eslint-disable-next-line complexity
const refreshIssueLinks = async (serviceId, depotId, context) => {
  const { config, repos, tenant } = context;
  const [service, depot] = await Promise.all([
    repos.issuerServices.findOne({ filter: { _id: serviceId } }),
    repos.depots.findOne({ filter: { _id: depotId } }),
  ]);
  validateIssueLink(service, depotId, depot);

  const refreshedDepot = isPreauthCodeAuth(service)
    ? await repos.depots.refreshPreauthCode(depotId)
    : depot;

  // Credential types are extracted from the depot
  const credentialTypes = await optional(loadCredentialTypeHints, [
    refreshedDepot,
    context,
  ]);

  const vnProtocolLinkUrl = buildIssuingDeepLink(
    tenant,
    service,
    refreshedDepot,
    credentialTypes,
    config.deepLinkProtocol,
  );

  const openid4vciProtocolLinkUrl =
    refreshedDepot?.preauthCode != null && !isEmpty(credentialTypes)
      ? await buildCredentialOfferLink(refreshedDepot, credentialTypes, context)
      : undefined;
  const redirectUrl = buildRedirectUrl(
    tenant,
    vnProtocolLinkUrl,
    openid4vciProtocolLinkUrl,
  );

  const links = {
    redirectUrl: redirectUrl.href,
    vnProtocolLink: vnProtocolLinkUrl.href,
    openidCredentialOffer: openid4vciProtocolLinkUrl,
  };

  if (refreshedDepot?.preauthCode) {
    links.preauthCode = refreshedDepot.preauthCode;
  }
  return links;
};

const loadCredentialTypeHints = async (depot, context) => {
  const credentials = await context.repos.credentials.find(
    { filter: { depotId: depot._id } },
    { 'content.type': 1 },
  );
  return flow(
    flatMap('content.type'),
    uniq,
    omit(['VerifiableCredential']),
  )(credentials);
};

const refreshPresentationLinks = async (serviceId, depotId, context) => {
  const { config, repos, tenant } = context;
  const [service, depot] = await Promise.all([
    repos.relyingPartyServices.findOne({ filter: { _id: serviceId } }),
    optional(loadDepot, [depotId, repos]),
  ]);
  validatePresentationLink(service, serviceId, depotId, depot);

  const vnProtocolLinkUrl = buildPresentationDeepLink(
    tenant,
    service,
    depot,
    config.deepLinkProtocol,
  );
  const openid4vpRequestId = buildOpenid4vpRequestId(serviceId, depotId);
  const openid4vpLink = buildOpenid4vpAuthorizationRequestLink(
    tenant,
    openid4vpRequestId,
  );
  const redirectUrl = buildRedirectUrl(
    tenant,
    vnProtocolLinkUrl,
    openid4vpLink.protocolLink,
  );

  return {
    redirectUrl: redirectUrl.href,
    vnProtocolLink: vnProtocolLinkUrl.href,
    openid4vpProtocolLink: openid4vpLink.protocolLink,
  };
};

const loadDepot = (depotId, repos) =>
  repos.depots.findOne({ filter: { _id: depotId } });

const buildOpenid4vpRequestId = (serviceId, depotId) =>
  depotId == null
    ? `${OPENID4VP_SERVICE_REQUEST_PREFIX}${serviceId}`
    : `${OPENID4VP_DEPOT_REQUEST_PREFIX}${depotId}`;

module.exports = {
  refreshIssueLinks,
  refreshPresentationLinks,
};
