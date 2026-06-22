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
const { Oauth2ServerErrorResponseError } = require('@openid4vc/oauth2');
const { jwtDecode } = require('@verii/jwt');
const { nanoid } = require('nanoid');
const { Oidc4vciErrors } = require('../domain');
const {
  buildExchangeEvent,
  ExchangeProtocols,
  ExchangeStates,
  ExchangeTypes,
} = require('../../exchanges');
const { signVeriiCredentialsFacade } = require('../../credentials');

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

  try {
    const { payload } = jwtDecode(credentialRequest.proofs.jwt[0]);
    const credentialSubjectId = payload.iss;

    const { vcJwt, credentialMetadata } = await signVeriiCredentialsFacade(
      [credential.content],
      credentialSubjectId,
      [credential.typeMetadata],
      service,
      context,
    );

    const newExchange = buildExchange(
      service,
      ExchangeStates.CREDENTIALS_SIGNED,
      { credentialMetadata },
    );
    await repos.credentials.updateIssuedCredential(
      credential._id,
      jwtDecode(vcJwt).payload.vc.id,
      vcJwt,
      credentialSubjectId,
      false,
      newExchange,
    );

    return {
      credentials: [{ credential: vcJwt }],
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
