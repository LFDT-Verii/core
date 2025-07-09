/**
 * Copyright 2023 Velocity Team
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

/* eslint-disable camelcase */
const { isEmpty, map, compact } = require('lodash/fp');
const newError = require('http-errors');
const { getCredentialTypeDescriptor } = require('@verii/common-fetchers');
const {
  ensureTenantDefaultIssuingDisclosureIdPlugin,
  ensureDisclosureConfigurationTypePlugin,
  ensureDisclosureActivePlugin,
} = require('../../../../plugins');
const {
  ExchangeTypes,
  ExchangeStates,
  ExchangeProtocols,
  ensureExchangeStateValid,
  buildRequestResponseSchema,
  ExchangeErrorCodeState,
  assertDisclosureActive,
  getPushDelegate,
  signExchangeResponse,
  createPresentationRequest,
} = require('../../../../entities');

const credentialManifestController = async (fastify) => {
  fastify
    .register(ensureTenantDefaultIssuingDisclosureIdPlugin)
    .register(ensureDisclosureConfigurationTypePlugin)
    .register(ensureDisclosureActivePlugin)
    .get(
      '/get-credential-manifest',
      {
        schema: fastify.autoSchema({
          query: {
            type: 'object',
            properties: {
              credential_types: {
                type: 'array',
                items: { type: 'string' },
                default: [],
              },
              exchange_id: { type: 'string' },
              'push_delegate.push_token': { type: 'string' },
              'push_delegate.push_url': { type: 'string' },
              id: { type: 'string' },
              format: { type: 'string', enum: ['json'] },
              locale: { type: 'string' },
            },
            required: ['credential_types'],
          },
          response: {
            200: buildRequestResponseSchema('issuing', fastify.config),
          },
        }),
      },
      async (req) => {
        const {
          repos,
          query: { credential_types, exchange_id, push_delegate, id, locale },
          tenant,
          config: { isProd },
        } = req;

        const pushDelegate = getPushDelegate(push_delegate, req);
        const credentialTypes = compact(credential_types);

        const exchange = await findOrCreateExchange(
          exchange_id,
          pushDelegate,
          credentialTypes,
          id,
          req
        );
        const disclosure = await repos.disclosures.findById(
          exchange.disclosureId
        );

        // eslint-disable-next-line better-mutation/no-mutation
        req.exchange = exchange; // added onto the request for the exchange error handler
        await ensureExchangeStateValid(
          ExchangeErrorCodeState.EXCHANGE_INVALID,
          req
        );

        const presentationRequest = await createPresentationRequest(
          disclosure,
          exchange,
          req
        );

        const credentialTypeDescriptors = await Promise.all(
          map(
            (type) =>
              getCredentialTypeDescriptor(
                { type, locale, includeDisplay: true },
                req
              ),
            credentialTypes
          )
        );

        const credentialManifest = {
          ...presentationRequest,
          output_descriptors: credentialTypeDescriptors,
          issuer: { id: tenant.did },
        };

        // eslint-disable-next-line camelcase
        return {
          issuing_request:
            !isProd && req.query.format === 'json'
              ? credentialManifest
              : await signExchangeResponse(credentialManifest, {}, req),
        };
      }
    );
};

const getDisclosure = async (disclosureId, { repos, tenant }) => {
  if (disclosureId) {
    return repos.disclosures.findById(disclosureId);
  }

  if (tenant.defaultIssuingDisclosureId) {
    return repos.disclosures.findById(tenant.defaultIssuingDisclosureId);
  }

  return repos.disclosures.findDefaultIssuingDisclosure();
};

const findOrCreateExchange = async (
  exchangeId,
  pushDelegate,
  credentialTypes,
  disclosureId,
  context
) => {
  const { repos } = context;

  if (exchangeId) {
    return repos.exchanges.addState(
      exchangeId,
      ExchangeStates.CREDENTIAL_MANIFEST_REQUESTED,
      {
        pushDelegate,
        protocolMetadata: {
          protocol: ExchangeProtocols.VNF_API,
        },
      }
    );
  }

  const disclosure = await getDisclosure(disclosureId, context);

  if (isEmpty(disclosure)) {
    throw newError(404, 'Disclosure not found', {
      errorCode: 'disclosure_not_found',
    });
  }

  assertDisclosureActive(disclosure, context);

  return repos.exchanges.insertWithInitialState(
    {
      type: ExchangeTypes.ISSUING,
      disclosureId: disclosure._id,
      pushDelegate,
      credentialTypes,
      protocolMetadata: {
        protocol: ExchangeProtocols.VNF_API,
      },
    },
    [ExchangeStates.CREDENTIAL_MANIFEST_REQUESTED]
  );
};

module.exports = credentialManifestController;

module.exports.autoPrefix = '/issue';
