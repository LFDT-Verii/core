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
const { omitBy, isNil } = require('lodash/fp');
const { Oidc4vciErrors } = require('../domain');
const { ExchangeStates } = require('../../exchanges');
const { anchorVeriiCredentialsFacade } = require('../../credentials');

// eslint-disable-next-line complexity
const handleNotification = async (notificationRequest, context) => {
  const { repos } = context;
  const credential = await repos.credentials.findOne(
    { filter: { 'exchange.id': notificationRequest.notification_id } },
    { exchange: 1 },
  );

  if (credential?.exchange == null) {
    throw new Oauth2ServerErrorResponseError({
      error: Oidc4vciErrors.INVALID_NOTIFICATION_ID,
      error_description: `Error identifying notification ${notificationRequest.notification_id}`,
    });
  }

  try {
    switch (notificationRequest.event) {
      case 'credential_accepted': {
        await anchorVeriiCredentialsFacade(
          [credential?.exchange.credentialMetadata],
          context,
        );
        await repos.credentials.addExchangeState(
          credential._id,
          ExchangeStates.COMPLETE,
          { acceptedAt: new Date() },
        );
        break;
      }
      case 'credential_deleted':
        await repos.credentials.addExchangeState(
          credential._id,
          ExchangeStates.COMPLETE,
          { deletedAt: new Date() },
        );
        break;
      case 'credential_failure':
        await repos.credentials.addExchangeState(
          credential._id,
          ExchangeStates.CLIENT_ERROR,
          {
            'exchange.err': 'client_credential_failure',
            'exchange.errorDescription': notificationRequest.event_description,
            failedAt: new Date(),
          },
        );
        break;
      default:
        throw new Oauth2ServerErrorResponseError({
          error: Oidc4vciErrors.INVALID_NOTIFICATION_REQUEST,
          error_description: 'event not supported',
        });
    }
  } catch (error) {
    context.log.error(error);
    await repos.credentials.addExchangeState(
      credential._id,
      ExchangeStates.UNEXPECTED_ERROR,
      omitBy(isNil, {
        'exchange.err': error.message,
        'exchange.errorCode': error.errorCode,
        'exchange.errorDescription': error.error_description,
      }),
    );
    throw new Oauth2ServerErrorResponseError({
      error: 'server_error',
      error_description: error.message,
    });
  }
};

module.exports = { handleNotification };
