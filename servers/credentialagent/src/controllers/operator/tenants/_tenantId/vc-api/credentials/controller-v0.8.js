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

const { first } = require('lodash/fp');

const newError = require('http-errors');
const { nanoid } = require('nanoid');
const {
  CredentialFormat,
  ExchangeProtocols,
  ExchangeTypes,
  ExchangeStates,
  createVerifiableCredentials,
  finalizeExchange,
  initValidateOffer,
  prepareOffers,
} = require('../../../../../../entities');

const credentialsController = async (fastify) => {
  const validateOffer = initValidateOffer(fastify);
  if (fastify.config.vcApiEnabled !== true) {
    return;
  }

  fastify.post(
    '/issue',
    {
      schema: fastify.autoSchema({
        body: {
          $ref: 'https://velocitynetwork.foundation/vc-api/IssueCredentialRequest.schema.json#',
        },
        response: {
          201: {
            $ref: 'https://velocitynetwork.foundation/vc-api/IssueCredentialResponse.schema.json#',
          },
        },
      }),
    },
    async (req, reply) => {
      const {
        body: { credential: offer, options },
        repos,
      } = req;

      // temporary validation until JSON-LD is supported natively
      if (options?.format !== CredentialFormat.JWT_VC) {
        throw newError.BadRequest(
          `options.format must be ${CredentialFormat.JWT_VC}`
        );
      }

      const exchange = await repos.exchanges.insertWithInitialState({
        type: ExchangeTypes.ISSUING,
        protocolMetadata: {
          protocol: ExchangeProtocols.W3C_VC_API,
        },
        createdBy: req.user.user,
      });
      // add "exchange" prop onto "req" so that all functions that assume exchange is on the context work without modification
      // eslint-disable-next-line better-mutation/no-mutation
      req.exchange = exchange;

      const [preparedOffer] = await prepareOffers(
        [{ ...offer, offerId: nanoid() }],
        req
      );

      const validatedOffer = await validateOffer(
        preparedOffer,
        false,
        true,
        req
      );

      const dbOffer = await repos.offers.insert(validatedOffer);

      await repos.exchanges.addState(
        exchange._id,
        ExchangeStates.CLAIMING_IN_PROGRESS
      );

      const vcJwts = await createVerifiableCredentials(
        [dbOffer],
        offer.credentialSubject.id,
        options.consented != null ? new Date(options.consented) : new Date(),
        req
      );

      await finalizeExchange(exchange, [dbOffer._id], req);
      // eslint-disable-next-line better-mutation/no-mutation
      reply.statusCode = 201;
      return { verifiableCredential: first(vcJwts) };
    }
  );
};

module.exports = credentialsController;
