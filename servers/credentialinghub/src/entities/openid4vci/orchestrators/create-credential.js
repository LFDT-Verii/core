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
const { startsWith } = require('lodash/fp');
const { jwtDecode } = require('@verii/jwt');
const { nanoid } = require('nanoid');
const {
  DEFERRED_CREDENTIAL_IDENTIFIER_PREFIX,
  Oidc4vciErrors,
  Openid4vciTransactionStatuses,
} = require('../domain');
const { isClaimableCredential } = require('../../credentials');
const { createDeferredTransaction } = require('./create-deferred-credential');
const { signCredential } = require('./sign-credential');

const createCredential = async (credentialRequestParameters, context) => {
  const { repos } = context;
  const openid4VciIssuer = await context.getOpenId4VciIssuer();
  const credentialRequest = await openid4VciIssuer.getCredentialRequest(
    credentialRequestParameters,
  );
  const { payload } = jwtDecode(credentialRequest.proofs.jwt[0]);
  const credentialSubjectId = payload.iss;

  if (
    startsWith(
      DEFERRED_CREDENTIAL_IDENTIFIER_PREFIX,
      credentialRequest.credentialIdentifier,
    )
  ) {
    return createDeferredTransaction(
      credentialRequest.credentialIdentifier,
      credentialSubjectId,
      openid4VciIssuer,
      context,
    );
  }

  // Only the depot that the access token was issued for.
  const credential = await repos.credentials.findByIdInDepot(
    credentialRequest.credentialIdentifier,
    context.openid4vciDepotId,
  );

  if (credential == null) {
    throw new Oauth2ServerErrorResponseError({
      error: Oidc4vciErrors.UNKNOWN_CREDENTIAL_IDENTIFIER,
      error_description: `Error identifying credential ${credentialRequest.credentialIdentifier}`,
    });
  }
  if (!isClaimableCredential(credential)) {
    throw new Oauth2ServerErrorResponseError({
      error: Oidc4vciErrors.CREDENTIAL_REQUEST_DENIED,
      error_description: `Credential ${credentialRequest.credentialIdentifier} can't be issued again`,
    });
  }

  const depot = await repos.depots.findById(credential.depotId);
  const service = await repos.issuerServices.findById(depot.serviceId);
  const transaction = {
    depotId: credential.depotId,
    serviceId: service._id,
    credentialId: credential._id,
  };

  try {
    const { vcJwt, credentialMetadata } = await signCredential(
      credential,
      credentialSubjectId,
      service,
      context,
    );

    const notificationId = nanoid(12);
    await repos.openid4vciTransactions.insert({
      ...transaction,
      credentialSubjectId,
      notificationId,
      status: Openid4vciTransactionStatuses.SIGNED,
      credentialMetadata,
    });
    await repos.credentials.updateIssuedCredential(
      credential._id,
      vcJwt,
      credentialSubjectId,
      false,
    );

    return {
      credentials: [{ credential: vcJwt }],
      notification_id: notificationId,
    };
  } catch (error) {
    context.log.error(error);
    await repos.openid4vciTransactions.insert({
      ...transaction,
      status: Openid4vciTransactionStatuses.ERROR,
      err: error.message,
      errorCode: error.errorCode,
      errorDescription: error.error_description,
    });

    throw new Oauth2ServerErrorResponseError({
      error: 'server_error',
      error_description: error.message,
    });
  }
};

module.exports = { createCredential };
