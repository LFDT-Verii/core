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

const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const { map } = require('lodash/fp');
const newError = require('http-errors');
const {
  ExchangeProtocols,
  ExchangeStates,
  ExchangeTypes,
  buildPresentationRequest,
} = require('../../exchanges');
const {
  validateReferencedService,
} = require('../../exchanges/domain/validate-referenced-service');
const { fetchCredentialTypeDescriptors } = require('../../credential-types');
const {
  buildPresentationRequestExpiresAt,
  getPresentationRequestsExpireIn,
  parseOpenid4vpRequestId,
  parseWalletMetadata,
} = require('../domain');

const createAuthorizationRequest = async (
  requestId,
  { walletMetadata, walletNonce },
  context,
) => {
  const { tenant, repos } = context;
  parseWalletMetadata(walletMetadata);

  const { relyingPartyService, depot: existingDepot } =
    await loadRequestReference(requestId, context);

  validateReferencedService(relyingPartyService);
  const presentationRequestsExpireIn =
    getPresentationRequestsExpireIn(relyingPartyService);

  const depot =
    existingDepot ??
    (await repos.depots.insert({
      serviceId: new ObjectId(relyingPartyService._id),
    }));
  const exchangeId = new ObjectId();
  const protocolMetadata = {
    protocol: ExchangeProtocols.OPENID4VP,
    nonce: generateNonce(),
    walletNonce,
  };
  const presentationRequest = await buildVelocityPresentationRequest(
    tenant,
    relyingPartyService,
    {
      _id: exchangeId,
      serviceId: new ObjectId(relyingPartyService._id),
      protocolMetadata,
      depotId: new ObjectId(depot._id),
    },
    context,
  );

  const exchange = await repos.exchanges.insertWithInitialState(
    {
      _id: exchangeId,
      type: ExchangeTypes.RELYING_PARTY,
      serviceId: new ObjectId(relyingPartyService._id),
      protocolMetadata: {
        ...protocolMetadata,
        presentationDefinition: presentationRequest.presentation_definition,
        presentationRequestExpiresAt:
          buildPresentationRequestExpiresAt(relyingPartyService),
      },
      depotId: new ObjectId(depot._id),
    },
    [ExchangeStates.PRESENTATION_REQUEST_REQUESTED],
  );
  // eslint-disable-next-line better-mutation/no-mutation
  context.exchange = exchange;

  const openid4vpVerifier = await context.getOpenId4VpVerifier();

  return openid4vpVerifier.createAuthorizationRequestJwt({
    requestId,
    authorizationRequestPayload: {
      response_type: 'vp_token',
      response_mode: 'direct_post',
      client_id: `decentralized_identifier:${tenant.did}`,
      response_uri: `${tenant.hostUrl}/r/${tenant._id}/openid4vp/direct-post`,
      nonce: exchange.protocolMetadata.nonce,
      wallet_nonce: walletNonce,
      presentation_definition: presentationRequest.presentation_definition,
      client_metadata: {
        client_name: tenant.name,
        logo_uri: tenant.logo,
        vp_formats_supported: {
          jwt_vc_json: { alg_values: ['ES256', 'ES256K'] },
        },
      },
      state: exchange._id.toString(),
    },
    requestUri: `${tenant.hostUrl}/r/${tenant._id}/openid4vp/authorization-request/${requestId}`,
    expiresInSeconds: presentationRequestsExpireIn,
    walletNonce,
  });
};

const loadRequestReference = async (requestId, context) => {
  const parsedRequestId = parseOpenid4vpRequestId(requestId);
  if (parsedRequestId.type === 'service') {
    return loadServiceRequestReference(parsedRequestId.id, context);
  }
  return loadDepotRequestReference(parsedRequestId.id, context);
};

const loadServiceRequestReference = async (serviceId, { repos }) => {
  const relyingPartyService = await repos.relyingPartyServices.findOne({
    filter: { _id: serviceId },
  });

  return { relyingPartyService };
};

const loadDepotRequestReference = async (depotId, { repos }) => {
  const depot = await repos.depots.findOne({
    filter: { _id: depotId },
  });
  if (!depot) {
    throw newError(400, 'referenced_depot_not_found', {
      errorCode: 'referenced_depot_not_found',
    });
  }

  const relyingPartyService = await repos.relyingPartyServices.findOne({
    filter: { _id: depot.serviceId },
  });

  return { relyingPartyService, depot };
};

const buildVelocityPresentationRequest = async (
  tenant,
  relyingPartyService,
  exchange,
  context,
) => {
  const inputDescriptors = relyingPartyService.presentationDefinition
    ? []
    : await fetchCredentialTypeDescriptors(
        map('type', relyingPartyService?.disclosureRequest?.types),
        false,
        undefined,
        context,
      );

  return buildPresentationRequest(
    tenant,
    relyingPartyService,
    exchange,
    inputDescriptors,
  );
};

const generateNonce = () => crypto.randomBytes(16).toString('base64url');

module.exports = {
  createAuthorizationRequest,
  buildVelocityPresentationRequest,
};
