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
const { ExchangeStates } = require('../../exchanges/domain/exchange-states');
const {
  sendWalletMessage,
  WalletMessageStatuses,
} = require('../../wallet-messages');
const { DepotErrors } = require('../domain');

const ResolveDepotCredentialsStatuses = {
  ...WalletMessageStatuses,
  ALREADY_RESOLVED: 'already_resolved',
  SKIPPED_NO_WAITING_EXCHANGE: 'skipped_no_waiting_exchange',
};

const resolveDepotCredentials = async (depotId, context) => {
  const depot = await context.repos.depots.resolveDepotCredentials(depotId);
  if (depot == null) {
    return {
      depot: await loadDepot(depotId, context),
      notification: {
        status: ResolveDepotCredentialsStatuses.ALREADY_RESOLVED,
      },
    };
  }
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
  const exchange =
    await context.repos.exchanges.findLatestVnApiExchangeByDepotId(
      depot._id,
      { _id: 1, credentialTypes: 1, messagingSettings: 1 },
      {
        'events.state': {
          $eq: ExchangeStates.OFFERS_WAITING,
          $ne: ExchangeStates.COMPLETE,
        },
      },
    );
  if (exchange == null) {
    return {
      status: ResolveDepotCredentialsStatuses.SKIPPED_NO_WAITING_EXCHANGE,
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

const sendNoOffersFound = async (exchange, context) => {
  const notification = await sendWalletMessage(
    { exchange, data: buildMessageData('NoOffersFound', exchange, context) },
    context,
  );
  await context.repos.exchanges.addState(
    exchange._id,
    ExchangeStates.NO_OFFERS_RECEIVED,
  );
  await context.repos.exchanges.addState(exchange._id, ExchangeStates.COMPLETE);
  return notification;
};

const buildMessageData = (notificationType, exchange, { tenant }) => ({
  notificationType,
  issuer: tenant.did,
  serviceEndpoint: exchange.messagingSettings?.webhookUrl,
});

module.exports = { resolveDepotCredentials, ResolveDepotCredentialsStatuses };
