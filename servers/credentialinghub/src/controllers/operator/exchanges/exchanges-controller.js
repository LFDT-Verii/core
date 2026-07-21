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
 */

const newError = require('http-errors');
const { tenantLoaderPlugin } = require('../../../entities/tenants');
const { ExchangeStates } = require('../../../entities/exchanges');
const { exchangeSchema } = require('./schemas/exchange.schema');

const SAFE_ERRORS = {
  [ExchangeStates.AUTHENTICATION_FAILURE]: {
    code: 'authentication_failure',
    message: 'Wallet authentication failed.',
  },
  [ExchangeStates.CLIENT_ERROR]: {
    code: 'client_error',
    message: 'The wallet reported a protocol error.',
  },
  [ExchangeStates.UNEXPECTED_ERROR]: {
    code: 'unexpected_error',
    message: 'The exchange ended unexpectedly.',
  },
};

const EXCHANGE_PROJECTION = {
  _id: 1,
  serviceId: 1,
  depotId: 1,
  type: 1,
  protocolMetadata: 1,
  events: 1,
  credentialIds: 1,
  finalizedCredentialIds: 1,
  createdAt: 1,
};

const toId = (value) => value?.toString();
const toTimestamp = (value) => new Date(value).toISOString();

const uniqueIds = (...idGroups) => [
  ...new Set(idGroups.flat().filter(Boolean).map(toId)),
];

const safeEvents = (events = []) =>
  events.map(({ state, timestamp }) => ({
    state,
    timestamp: toTimestamp(timestamp),
  }));

const findExchange = ({ exchangeId, depotId }, repos) => {
  if (exchangeId) {
    return repos.exchanges
      .findOne({ filter: { _id: exchangeId } }, EXCHANGE_PROJECTION)
      .catch((error) => {
        if (error.statusCode === 404) {
          return null;
        }
        throw error;
      });
  }
  return repos.exchanges.findLatestVnApiExchangeByDepotId(
    depotId,
    EXCHANGE_PROJECTION,
  );
};

const buildExchangeResponse = (exchange, presentations) => {
  const events = safeEvents(exchange.events);
  const state = events.at(-1)?.state;
  const error = SAFE_ERRORS[state];

  return {
    id: toId(exchange._id),
    depotId: toId(exchange.depotId),
    serviceId: toId(exchange.serviceId),
    type: exchange.type,
    protocol: exchange.protocolMetadata?.protocol,
    state,
    events,
    ...(error ? { error } : {}),
    credentialIds: uniqueIds(
      exchange.credentialIds ?? [],
      exchange.finalizedCredentialIds ?? [],
    ),
    presentationIds: presentations.map(({ _id }) => toId(_id)),
    createdAt: toTimestamp(exchange.createdAt),
  };
};

module.exports = async (fastify) => {
  fastify
    .addSchema(exchangeSchema)
    .register(tenantLoaderPlugin, { notFoundStatusCode: 400 })
    .get(
      '/get',
      {
        schema: fastify.autoSchema({
          query: {
            type: 'object',
            additionalProperties: false,
            properties: {
              tenantId: { type: 'string' },
              exchangeId: { type: 'string' },
              depotId: { type: 'string' },
            },
            oneOf: [
              {
                required: ['tenantId', 'exchangeId'],
              },
              {
                required: ['tenantId', 'depotId'],
              },
            ],
          },
          response: {
            200: {
              type: 'object',
              required: ['exchange'],
              properties: {
                exchange: { $ref: 'operator-exchange#' },
                requestId: { type: 'string' },
              },
            },
            404: { $ref: 'error#' },
          },
        }),
      },
      async (req) => {
        const exchange = await findExchange(req.query, req.repos);
        if (!exchange) {
          throw newError(404, 'Exchange not found', {
            errorCode: 'exchange_not_found',
          });
        }
        const presentations = await req.repos.presentations.search({
          exchangeId: exchange._id,
        });
        return {
          exchange: buildExchangeResponse(exchange, presentations),
        };
      },
    );
};
