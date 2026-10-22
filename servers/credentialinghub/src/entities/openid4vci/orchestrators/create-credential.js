/*
 * Copyright 2025 Velocity Team
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
const {
  Oauth2ErrorCodes,
  Oauth2ServerErrorResponseError,
} = require('@openid4vc/oauth2');
const { jwtDecode } = require('@verii/jwt');
const { nanoid } = require('nanoid');
const {
  assertOpenid4vciIssuedCredential,
  getOpenid4vciCredentialProfileByConfigurationId,
  Oidc4vciErrors,
} = require('../domain');
const {
  buildExchangeEvent,
  ExchangeProtocols,
  ExchangeStates,
  ExchangeTypes,
} = require('../../exchanges');
const { secureVeriiCredentialsFacade } = require('../../credentials');
const { resolveCredentialSigningAlgorithm } = require('../../tenants');

const createCredential = async (credentialRequestParameters, context) => {
  const { repos } = context;
  const openid4VciIssuer = await context.getOpenId4VciIssuer();
  const credentialRequest = await openid4VciIssuer.getCredentialRequest(
    credentialRequestParameters,
  );

  const credential = await repos.credentials.findOne({
    filter: { _id: credentialRequest.credentialIdentifier },
  });

  if (credential == null) {
    throw new Oauth2ServerErrorResponseError({
      error: Oidc4vciErrors.UNKNOWN_CREDENTIAL_IDENTIFIER,
      error_description: `Error identifying credential ${credentialRequest.credentialIdentifier}`,
    });
  }

  const depot = await repos.depots.findById(credential.depotId);
  const service = await repos.issuerServices.findById(depot.serviceId);
  const credentialProfile = getAuthorizedCredentialProfile({
    accessTokenPayload: context.openid4vciAccessTokenPayload,
    credentialIdentifier: `${credential._id}`,
    credentialType: credential.typeMetadata.credentialType,
    requestedFormat: credentialRequest.format,
  });

  try {
    const { payload } = jwtDecode(credentialRequest.proofs.jwt[0]);
    const credentialSubjectId = payload.iss;
    const credentialSigningAlgorithm = resolveCredentialSigningAlgorithm({
      credentialTypeMetadata: credential.typeMetadata,
      tenant: context.tenant,
    });

    const { issuedCredential, credentialMetadata } =
      await secureVeriiCredentialsFacade({
        context,
        credentialContentList: [credential.content],
        credentialFormat: credentialProfile.credentialFormat,
        credentialSigningAlgorithms: [credentialSigningAlgorithm],
        credentialSubjectId,
        credentialTypeMetadatas: [credential.typeMetadata],
        issuerService: service,
      });
    assertOpenid4vciIssuedCredential(issuedCredential, credentialProfile);

    const newExchange = buildExchange(
      service,
      ExchangeStates.CREDENTIALS_SIGNED,
      { credentialMetadata },
    );
    await repos.credentials.updateIssuedCredential(
      credential._id,
      issuedCredential,
      credentialSubjectId,
      false,
      newExchange,
    );

    return {
      credentials: [{ credential: issuedCredential.securedCredential }],
      notification_id: newExchange.id,
    };
  } catch (error) {
    context.log.error(error);
    await repos.credentials.update(credential._id, {
      exchange: buildExchange(service, ExchangeStates.UNEXPECTED_ERROR, {
        err: error.message,
        errorCode: error.errorCode,
        errorDescription: error.error_description,
      }),
    });

    throw new Oauth2ServerErrorResponseError({
      error: 'server_error',
      error_description: error.message,
    });
  }
};

const getAuthorizedCredentialProfile = ({
  accessTokenPayload,
  credentialIdentifier,
  credentialType,
  requestedFormat,
}) => {
  const matchingAuthorizationDetails = (
    accessTokenPayload?.authorization_details ?? []
  ).filter(({ credential_identifiers: credentialIdentifiers }) =>
    credentialIdentifiers?.includes(credentialIdentifier),
  );
  const profiles = matchingAuthorizationDetails
    .map(({ credential_configuration_id: credentialConfigurationId }) =>
      getOpenid4vciCredentialProfileByConfigurationId(
        credentialConfigurationId,
        credentialType,
      ),
    )
    .filter(Boolean);
  if (profiles.length !== 1) {
    throw new Oauth2ServerErrorResponseError({
      error: Oauth2ErrorCodes.InvalidCredentialRequest,
      error_description: `Credential ${credentialIdentifier} is not authorized for a supported credential configuration`,
    });
  }

  const [profile] = profiles;
  if (requestedFormat != null && requestedFormat !== profile.format) {
    throw new Oauth2ServerErrorResponseError({
      error: Oauth2ErrorCodes.InvalidCredentialRequest,
      error_description: `Credential format ${requestedFormat} does not match the authorized credential configuration`,
    });
  }

  return profile;
};

const buildExchange = (service, state, overrides) => ({
  id: nanoid(12),
  type: ExchangeTypes.ISSUER,
  serviceId: service._id,
  protocolMetadata: {
    protocol: ExchangeProtocols.OPENID4VCI,
  },
  events: [buildExchangeEvent(ExchangeStates.NEW), buildExchangeEvent(state)],
  ...overrides,
});

module.exports = { createCredential };
