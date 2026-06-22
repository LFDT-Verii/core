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
const newError = require('http-errors');
const { isNil, omitBy } = require('lodash/fp');
const {
  verifyVerifiablePresentationJwt,
} = require('@verii/verii-verification');
const {
  ExchangeProtocols,
  ExchangeStates,
  validateReferencedService,
} = require('../../exchanges');
const {
  PresentationFormat,
  validatePresentation,
} = require('../../presentations');

const postAuthorizationResponse = async (authorizationResponse, context) => {
  const { repos, tenant } = context;
  const exchange = await repos.exchanges.findOne({
    filter: { _id: authorizationResponse.state },
  });
  validateOpenid4vpExchangeExists(exchange);

  try {
    validateOpenid4vpExchange(exchange);

    if (authorizationResponse.error) {
      return handleErrorResponse(authorizationResponse, exchange, context);
    }

    const [depot, relyingPartyService] = await Promise.all([
      repos.depots.findOne({
        filter: { _id: exchange.depotId },
      }),
      repos.relyingPartyServices.findOne({
        filter: { _id: exchange.serviceId },
      }),
    ]);
    validateOpenid4vpDepot(depot, exchange);
    validateReferencedService(relyingPartyService);

    const openid4vpVerifier = await context.getOpenId4VpVerifier();
    const parsedAuthorizationResponse =
      await openid4vpVerifier.parseAuthorizationResponse({
        authorizationResponse,
        authorizationRequestPayload: {
          response_type: 'vp_token',
          response_mode: 'direct_post',
          client_id: `decentralized_identifier:${tenant.did}`,
          response_uri: `${tenant.hostUrl}/r/${tenant._id}/openid4vp/direct-post`,
          nonce: exchange.protocolMetadata.nonce,
          presentation_definition:
            exchange.protocolMetadata.presentationDefinition,
          state: exchange._id.toString(),
        },
      });
    validateOpenid4vpVpTokenCount(
      parsedAuthorizationResponse.pex.presentations,
      exchange.protocolMetadata.presentationDefinition,
    );

    const validatedPresentations = await Promise.all(
      parsedAuthorizationResponse.pex.presentations.map((jwtPresentation) =>
        validateOpenid4vpPresentation(
          jwtPresentation,
          parsedAuthorizationResponse.pex.presentationSubmission,
          exchange,
          context,
        ),
      ),
    );

    const presentations = await Promise.all(
      validatedPresentations.map((validatedPresentation) =>
        storePresentation(validatedPresentation, exchange, context),
      ),
    );

    const updatedExchange = await repos.exchanges.addState(
      exchange._id,
      ExchangeStates.PRESENTATION_SUBMISSION_RECEIVED,
      {
        disclosureConsentedAt: new Date(),
      },
    );

    return { relyingPartyService, exchange: updatedExchange, presentations };
  } catch (error) {
    await recordOpenid4vpFailure(exchange, error, context);
    throw error;
  }
};

const handleErrorResponse = async (
  authorizationResponse,
  exchange,
  { repos },
) => {
  const updatedExchange = await repos.exchanges.addState(
    exchange._id,
    ExchangeStates.CLIENT_ERROR,
    omitBy(isNil, {
      err: authorizationResponse.error,
      errorDescription: authorizationResponse.error_description,
    }),
  );

  return { exchange: updatedExchange, presentations: [] };
};

const validateOpenid4vpExchangeExists = (exchange) => {
  if (!exchange) {
    throw newError(400, 'Referenced exchange not found', {
      errorCode: 'referenced_exchange_not_found',
    });
  }
};

const validateOpenid4vpExchange = (exchange) => {
  validateOpenid4vpProtocol(exchange.protocolMetadata);
  validateOpenid4vpExchangeNotProcessed(exchange);
  validateOpenid4vpRequestMetadata(exchange.protocolMetadata);
  validateOpenid4vpExchangeReferences(exchange);
  validateOpenid4vpPresentationRequestNotExpired(exchange.protocolMetadata);
};

const validateOpenid4vpProtocol = ({ protocol } = {}) => {
  if (protocol !== ExchangeProtocols.OPENID4VP) {
    throw newError(400, 'Referenced exchange is not an OpenID4VP exchange', {
      errorCode: 'openid4vp_exchange_invalid',
    });
  }
};

const validateOpenid4vpExchangeNotProcessed = ({ events = [] }) => {
  if (!hasTerminalOpenid4vpEvent(events)) {
    return;
  }

  throw newError(400, 'OpenID4VP authorization response already processed', {
    errorCode: 'openid4vp_authorization_response_already_processed',
  });
};

const hasTerminalOpenid4vpEvent = (events = []) =>
  events.some(({ state }) =>
    [
      ExchangeStates.PRESENTATION_SUBMISSION_RECEIVED,
      ExchangeStates.CLIENT_ERROR,
      ExchangeStates.UNEXPECTED_ERROR,
    ].includes(state),
  );

const validateOpenid4vpRequestMetadata = ({
  nonce,
  presentationDefinition,
  presentationRequestExpiresAt,
} = {}) => {
  if (!nonce) {
    throw newError(400, 'OpenID4VP exchange nonce is missing', {
      errorCode: 'openid4vp_exchange_nonce_missing',
    });
  }
  if (!presentationDefinition) {
    throw newError(400, 'OpenID4VP presentation definition is missing', {
      errorCode: 'openid4vp_presentation_definition_missing',
    });
  }
  if (!presentationRequestExpiresAt) {
    throw newError(400, 'OpenID4VP presentation request expiry is missing', {
      errorCode: 'openid4vp_presentation_request_expiry_missing',
    });
  }
};

const validateOpenid4vpExchangeReferences = ({ depotId }) => {
  if (!depotId) {
    throw newError(400, 'OpenID4VP exchange depot is missing', {
      errorCode: 'openid4vp_exchange_depot_missing',
    });
  }
};

const validateOpenid4vpPresentationRequestNotExpired = ({
  presentationRequestExpiresAt,
}) => {
  if (presentationRequestExpiresAt > new Date()) {
    return;
  }

  throw newError(400, 'OpenID4VP presentation request has expired', {
    errorCode: 'openid4vp_presentation_request_expired',
  });
};

const recordOpenid4vpFailure = async (exchange, error, { log, repos }) => {
  if (
    exchange.protocolMetadata?.protocol !== ExchangeProtocols.OPENID4VP ||
    hasTerminalOpenid4vpEvent(exchange.events)
  ) {
    return;
  }

  const failureMetadata = getOpenid4vpFailureMetadata(error);
  await repos.exchanges
    .addState(exchange._id, getOpenid4vpFailureState(error), failureMetadata)
    .catch((recordingError) => {
      log.error({
        err: recordingError,
        exchangeId: exchange._id,
        openid4vpErrorCode: failureMetadata.err,
      });
    });
};

const getOpenid4vpFailureState = (error) =>
  hasExplicitErrorCode(error)
    ? ExchangeStates.CLIENT_ERROR
    : ExchangeStates.UNEXPECTED_ERROR;

const getOpenid4vpFailureMetadata = (error) =>
  hasExplicitErrorCode(error)
    ? {
        err: error.errorCode,
        errorDescription: error.message,
      }
    : {
        err: 'openid4vp_internal_error',
        errorDescription: 'Unexpected OpenID4VP processing error',
      };

const hasExplicitErrorCode = (error) => error.errorCode != null;

const validateOpenid4vpDepot = (depot, { serviceId }) => {
  if (depot?.serviceId?.toString() === serviceId.toString()) {
    return;
  }

  throw newError(400, 'referenced_depot_not_found', {
    errorCode: 'referenced_depot_not_found',
  });
};

const validateOpenid4vpVpTokenCount = (
  presentations,
  presentationDefinition,
) => {
  const inputDescriptorCount =
    presentationDefinition.input_descriptors?.length ?? 0;
  if (presentations.length < 1) {
    throwOpenid4vpVpTokenMissing();
  }
  if (presentations.length <= inputDescriptorCount) {
    return;
  }

  throw newError(
    400,
    'OpenID4VP VP token count exceeds presentation definition input descriptor count',
    {
      errorCode: 'openid4vp_vp_token_count_exceeds_input_descriptors',
    },
  );
};

const throwOpenid4vpVpTokenMissing = () => {
  throw newError(400, 'OpenID4VP VP token is missing', {
    errorCode: 'openid4vp_vp_token_missing',
  });
};

const validateOpenid4vpPresentation = async (
  jwtPresentation,
  presentationSubmission,
  exchange,
  context,
) => {
  const verifiablePresentation =
    await verifyOpenid4vpPresentationJwt(jwtPresentation);
  validateOpenid4vpPresentationClaims(
    verifiablePresentation,
    exchange,
    context,
  );
  // Current wallets use the same PEX v1 descriptor-map shape as VN API, with
  // paths rooted at the decoded VP. OpenID4VP draft 25 PEX uses response-level
  // VP-token paths ($ or $[n]) plus path_nested for credentials; full draft-25
  // multi-VP response satisfaction is deferred to DCQL/query support.
  validatePresentation(
    verifiablePresentation,
    exchange,
    context,
    presentationSubmission,
  );

  return { jwtPresentation };
};

const verifyOpenid4vpPresentationJwt = async (jwtPresentation) => {
  try {
    return await verifyVerifiablePresentationJwt(jwtPresentation, {
      vnfProtocolVersion: 2,
    });
  } catch (error) {
    throw newError(400, 'Invalid OpenID4VP presentation', {
      errorCode: 'openid4vp_presentation_invalid',
      cause: error,
    });
  }
};

const storePresentation = ({ jwtPresentation }, exchange, { repos }) =>
  repos.presentations.insert({
    depotId: exchange.depotId,
    exchangeId: exchange._id,
    format: PresentationFormat.JWT_VP,
    presentation: jwtPresentation,
  });

const validateOpenid4vpPresentationClaims = (
  { nonce, verifier },
  exchange,
  { tenant },
) => {
  if (nonce !== exchange.protocolMetadata.nonce) {
    throw newError(400, 'OpenID4VP presentation nonce mismatch', {
      errorCode: 'openid4vp_presentation_nonce_mismatch',
    });
  }
  const expectedVerifier = `decentralized_identifier:${tenant.did}`;
  if (verifier !== expectedVerifier) {
    throw newError(400, 'OpenID4VP presentation verifier mismatch', {
      errorCode: 'openid4vp_presentation_verifier_mismatch',
    });
  }
};

module.exports = { postAuthorizationResponse };
