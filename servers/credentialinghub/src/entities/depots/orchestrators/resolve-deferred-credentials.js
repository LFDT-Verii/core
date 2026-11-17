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
const { flow, isEmpty, map, uniq, uniqBy } = require('lodash/fp');
const { extractCredentialType } = require('@verii/vc-checks');
const {
  sendWalletMessage,
  WalletMessageStatuses,
} = require('../../wallet-messages');
const { DepotErrors } = require('@verii/credentialing-hub-operator-api');

const ResolveDeferredCredentialsStatuses = {
  ...WalletMessageStatuses,
  SKIPPED_NO_WAITING_EXCHANGE: 'skipped_no_waiting_exchange',
};

// Settles whoever is waiting on the depot now. The depot keeps deferring, so it can be called again later.
const resolveDeferredCredentials = async (depotId, context) => {
  await loadDepot(depotId, context);
  // Set before any message, so wallets that poll credential-offers learn the outcome too
  const depot = await context.repos.depots.update(depotId, {
    deferredCredentialsResolvedAt: new Date(),
  });
  return { depot, notification: await notifyWaitingExchange(depot, context) };
};

const loadDepot = async (depotId, { repos }) => {
  const depot = await repos.depots.findOne({ filter: { _id: depotId } });
  if (depot == null) {
    throw newError(404, `Depot ${depotId} not found`, {
      errorCode: DepotErrors.DEPOT_NOT_FOUND,
    });
  }
  return depot;
};

const notifyWaitingExchange = async (depot, context) => {
  const exchange = await context.repos.exchanges.findWaitingVnApiExchange(
    depot._id,
    { _id: 1, credentialTypes: 1, messagingSettings: 1 },
  );
  if (exchange == null) {
    return {
      status: ResolveDeferredCredentialsStatuses.SKIPPED_NO_WAITING_EXCHANGE,
    };
  }

  // The same credentials that credential-offers would offer
  const credentials = await context.repos.credentials.findByDepotId({
    depotId: depot._id,
    credentialTypes: exchange.credentialTypes,
    claimable: true,
  });
  const notification = isEmpty(credentials)
    ? await sendNoOffersFound(exchange, context)
    : await sendNewOffersReady(exchange, credentials, context);
  return { ...notification, exchangeId: `${exchange._id}` };
};

const sendNewOffersReady = (exchange, credentials, context) => {
  const offers = uniqBy('contentHash', credentials);
  return sendWalletMessage(
    {
      exchange,
      data: {
        ...buildMessageData('NewOffersReady', exchange, context),
        credentialTypes: flow(
          map(({ content }) => extractCredentialType(content)),
          uniq,
        )(offers),
        count: offers.length,
      },
    },
    context,
  );
};

// Nothing is written to the exchange, which only the holder's requests change
const sendNoOffersFound = (exchange, context) =>
  sendWalletMessage(
    { exchange, data: buildMessageData('NoOffersFound', exchange, context) },
    context,
  );

const buildMessageData = (notificationType, exchange, { tenant }) => ({
  notificationType,
  issuer: tenant.did,
  serviceEndpoint: exchange.messagingSettings?.webhookUrl,
});

module.exports = {
  resolveDeferredCredentials,
  ResolveDeferredCredentialsStatuses,
};
