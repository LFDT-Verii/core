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
const { Oidc4vciErrors, Openid4vciTransactionStatuses } = require('../domain');
const { anchorVeriiCredentialsFacade } = require('../../credentials');

const handleNotification = async (notificationRequest, context) => {
  const { repos } = context;
  const transaction = await findNotifiedTransaction(
    notificationRequest.notification_id,
    context,
  );

  try {
    switch (notificationRequest.event) {
      case 'credential_accepted':
        await acceptCredential(transaction, context);
        break;
      case 'credential_deleted':
        await repos.openid4vciTransactions.update(transaction._id, {
          status: Openid4vciTransactionStatuses.DELETED,
        });
        await repos.credentials.update(transaction.credentialId, {
          deletedAt: new Date(),
        });
        break;
      case 'credential_failure':
        await repos.openid4vciTransactions.update(transaction._id, {
          status: Openid4vciTransactionStatuses.FAILED,
          err: 'client_credential_failure',
          errorDescription: notificationRequest.event_description,
        });
        await repos.credentials.update(transaction.credentialId, {
          failedAt: new Date(),
        });
        break;
      default:
        throw new Oauth2ServerErrorResponseError({
          error: Oidc4vciErrors.INVALID_NOTIFICATION_REQUEST,
          error_description: 'event not supported',
        });
    }
  } catch (error) {
    context.log.error(error);
    // Leaves the status alone, so the wallet can retry the notification.
    await repos.openid4vciTransactions.update(transaction._id, {
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

// The transaction outlives its credential, which an operator may delete.
const findNotifiedTransaction = async (notificationId, context) => {
  const { repos, openid4vciDepotId } = context;
  const transaction =
    await repos.openid4vciTransactions.findByNotificationIdInDepot(
      notificationId,
      openid4vciDepotId,
    );
  const credential =
    transaction == null
      ? null
      : await repos.credentials.findByIdInDepot(
          transaction.credentialId,
          openid4vciDepotId,
        );

  if (credential == null) {
    throw new Oauth2ServerErrorResponseError({
      error: Oidc4vciErrors.INVALID_NOTIFICATION_ID,
      error_description: `Error identifying notification ${notificationId}`,
    });
  }

  return transaction;
};

const acceptCredential = async (transaction, context) => {
  const { repos } = context;
  // A repeated notification must not anchor the transaction's metadata index again,
  // even after a later event has changed the status.
  // This doesn't stop a duplicate that arrives while the first is still anchoring (#1118).
  if (transaction.acceptedAt != null) {
    return;
  }

  await anchorVeriiCredentialsFacade([transaction.credentialMetadata], context);
  const acceptedAt = new Date();
  await repos.openid4vciTransactions.update(transaction._id, {
    status: Openid4vciTransactionStatuses.ACCEPTED,
    acceptedAt,
  });
  await repos.credentials.update(transaction.credentialId, { acceptedAt });
};

module.exports = { handleNotification };
