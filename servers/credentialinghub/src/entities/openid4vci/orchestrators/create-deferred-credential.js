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
const {
  Oauth2ErrorCodes,
  Oauth2ServerErrorResponseError,
} = require('@openid4vc/oauth2');
const { includes } = require('lodash/fp');
const { nanoid } = require('nanoid');
const { calcSha384 } = require('@verii/crypto');
const {
  DEFERRED_CREDENTIAL_IDENTIFIER_PREFIX,
  Oidc4vciErrors,
  Openid4vciTransactionStatuses,
} = require('../domain');
const { signCredential } = require('./sign-credential');

// A credential request for a `deferred:<credential type>` identifier stores a pending transaction for the holder,
// then claims a credential for it at once if it can.
const createDeferredTransaction = async (
  credentialIdentifier,
  credentialSubjectId,
  openid4VciIssuer,
  context,
) => {
  const { repos } = context;
  const credentialType = credentialIdentifier.slice(
    DEFERRED_CREDENTIAL_IDENTIFIER_PREFIX.length,
  );
  const depot = await repos.depots.findOne({
    filter: { _id: context.openid4vciDepotId },
  });
  if (
    depot?.deferredCredentials !== true ||
    !includes(credentialType, depot.expectedCredentialTypes)
  ) {
    throw new Oauth2ServerErrorResponseError({
      error: Oidc4vciErrors.UNKNOWN_CREDENTIAL_IDENTIFIER,
      error_description: `Error identifying credential ${credentialIdentifier}`,
    });
  }

  const transactionId = nanoid(32);
  const transaction = await repos.openid4vciTransactions.insert({
    depotId: depot._id,
    serviceId: depot.serviceId,
    transactionIdHash: calcSha384(transactionId),
    credentialType,
    credentialSubjectId,
    status: Openid4vciTransactionStatuses.PENDING,
  });
  return resolveTransaction(
    transaction,
    transactionId,
    depot,
    openid4VciIssuer,
    context,
  );
};

const createDeferredCredential = async (
  deferredCredentialRequestParameters,
  context,
) => {
  const openid4VciIssuer = await context.getOpenId4VciIssuer();
  const { transaction_id: transactionId } =
    openid4VciIssuer.getDeferredCredentialRequest(
      deferredCredentialRequestParameters,
    );
  const { transaction, depot } = await loadTransaction(transactionId, context);
  if (transaction.status === Openid4vciTransactionStatuses.DENIED) {
    throw buildDeniedError(transaction);
  }

  return resolveTransaction(
    transaction,
    transactionId,
    depot,
    openid4VciIssuer,
    context,
  );
};

// Only a pending or denied transaction of the depot that the access token was issued for, while that depot exists.
// Known limitation: nothing locks the transaction while it's processed. So if two polls of one transaction arrive at
// the same time and the depot has two credentials of its type, each poll can claim and sign one.
const loadTransaction = async (transactionId, { openid4vciDepotId, repos }) => {
  const transaction =
    await repos.openid4vciTransactions.findByTransactionIdInDepot(
      transactionId,
      openid4vciDepotId,
    );
  const depot = includes(transaction?.status, [
    Openid4vciTransactionStatuses.PENDING,
    Openid4vciTransactionStatuses.DENIED,
  ])
    ? await repos.depots.findOne({ filter: { _id: transaction.depotId } })
    : null;
  if (depot == null) {
    throw new Oauth2ServerErrorResponseError({
      error: Oauth2ErrorCodes.InvalidTransactionId,
      error_description:
        'Error identifying the deferred credential transaction',
    });
  }
  return { transaction, depot };
};

const resolveTransaction = async (
  transaction,
  transactionId,
  depot,
  openid4VciIssuer,
  context,
) => {
  const { repos } = context;
  // Before claiming, so a failed lookup can't leave a credential claimed
  const service = await repos.issuerServices.findById(depot.serviceId);
  const credential =
    await repos.credentials.claimDeferredCredential(transaction);
  if (credential == null) {
    return waitOrDeny(
      transaction,
      transactionId,
      depot,
      openid4VciIssuer,
      context,
    );
  }

  const { vcJwt, credentialMetadata } = await issueClaimedCredential(
    credential,
    transaction,
    service,
    context,
  );
  const notificationId = nanoid(12);
  // Known limitation: if the process stops before this write, the credential is signed but its transaction stays
  // pending. Later polls then return 202, or credential_request_denied once the issuer resolves.
  await repos.openid4vciTransactions.update(transaction._id, {
    status: Openid4vciTransactionStatuses.SIGNED,
    credentialId: credential._id,
    notificationId,
    credentialMetadata,
  });
  return openid4VciIssuer.createDeferredCredentialResponse({
    credentials: [{ credential: vcJwt }],
    notificationId,
  });
};

// Signs the claimed credential for the transaction's holder. If that fails, the claim is released and the
// transaction stays pending, so the wallet can retry.
// Known limitation: if the process stops before the credential is signed or released, it stays claimed.
const issueClaimedCredential = async (
  credential,
  transaction,
  service,
  context,
) => {
  const { repos } = context;
  try {
    const { vcJwt, credentialMetadata } = await signCredential(
      credential,
      transaction.credentialSubjectId,
      service,
      context,
    );
    await repos.credentials.updateIssuedCredential(
      credential._id,
      vcJwt,
      transaction.credentialSubjectId,
      false,
    );
    return { vcJwt, credentialMetadata };
  } catch (error) {
    context.log.error(error);
    await repos.credentials.releaseDeferredCredential(
      credential._id,
      transaction._id,
    );
    await repos.openid4vciTransactions.update(transaction._id, {
      err: error.message,
      errorCode: error.errorCode,
      errorDescription: error.error_description,
    });
    throw new Oauth2ServerErrorResponseError(
      { error: 'server_error', error_description: error.message },
      { status: 500, cause: error },
    );
  }
};

// With nothing to claim, a transaction created before the issuer last resolved the depot's deferred credentials
// gets nothing more, so the poll denies its own transaction. Otherwise the wallet keeps polling.
const waitOrDeny = async (
  transaction,
  transactionId,
  depot,
  openid4VciIssuer,
  { config, repos },
) => {
  if (depot.deferredCredentialsResolvedAt > transaction.createdAt) {
    // Only a pending transaction, so one that a concurrent poll signed stays signed
    await repos.openid4vciTransactions.updateUsingFilter(
      {
        filter: {
          _id: transaction._id,
          status: Openid4vciTransactionStatuses.PENDING,
        },
      },
      { status: Openid4vciTransactionStatuses.DENIED },
    );
    throw buildDeniedError(transaction);
  }
  return openid4VciIssuer.createDeferredCredentialResponse({
    transactionId,
    interval: config.openid4vciDeferredIntervalSeconds,
  });
};

const buildDeniedError = (transaction) =>
  new Oauth2ServerErrorResponseError({
    error: Oidc4vciErrors.CREDENTIAL_REQUEST_DENIED,
    error_description: `No ${transaction.credentialType} credential can be issued`,
  });

module.exports = {
  createDeferredCredential,
  createDeferredTransaction,
};
