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

const Ajv = require('ajv');
const { isEmpty, flow, map, concat, uniq } = require('lodash/fp');
const newError = require('http-errors');
const {
  ExchangeTypes,
  VendorEndpoint,
  ExchangeErrors,
} = require('../../../../../entities');

const exchangeController = async (fastify) => {
  const ajvNoCoerce = new Ajv({
    ...fastify.config.ajvOptions,
    coerceTypes: false,
  });
  fastify.post(
    '/',
    {
      validatorCompiler: ({ schema }) => ajvNoCoerce.compile(schema),
      schema: fastify.autoSchema({
        body: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['ISSUING', 'DISCLOSURE'] },
            disclosureId: { type: 'string' },
            identityMatcherValues: {
              type: 'array',
              items: {
                anyOf: [
                  {
                    type: 'string',
                  },
                  {
                    type: 'number',
                  },
                  {
                    type: 'boolean',
                  },
                ],
              },
            },
          },
          required: ['type'],
        },
        response: {
          201: {
            type: 'object',
            properties: { id: { type: 'string' } },
            additionalProperties: false,
          },
        },
      }),
    },
    async (req, reply) => {
      const { repos, body, user } = req;
      const disclosure = await resolveDisclosure(body, req);
      const exchange = {
        disclosureId: disclosure._id,
        type: body.type,
        identityMatcherValues: body.identityMatcherValues,
        createdBy: user.user,
      };

      validateExchange(exchange, disclosure);

      const { _id } = await repos.exchanges.insertWithInitialState(exchange);
      reply.code(201);
      return { id: _id };
    }
  );

  const validateExchange = (exchange, disclosure) => {
    if (
      disclosure.vendorEndpoint !==
      VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION
    ) {
      return;
    }

    if (isEmpty(exchange.identityMatcherValues)) {
      throw newError.BadRequest(
        ExchangeErrors.IDENTITY_MATCHER_VALUES_REQUIRED
      );
    }

    const indexes = buildValueIndexes(disclosure.identityMatchers);
    validateRowDefinesAllIndexes(exchange.identityMatcherValues, indexes);
  };

  const buildValueIndexes = ({ rules, vendorUserIdIndex }) =>
    flow(map('valueIndex'), concat([vendorUserIdIndex]), uniq)(rules);

  const validateRowDefinesAllIndexes = (row, indexes) => {
    for (const index of indexes) {
      if (
        row[index] == null ||
        (typeof row[index] === 'string' && isEmpty(row[index]))
      ) {
        throw newError.BadRequest(
          ExchangeErrors.IDENTITY_MATCHER_VALUE_REQUIRED(index)
        );
      }
    }
  };

  const resolveDisclosure = async (
    { type, disclosureId },
    { repos, tenant }
  ) => {
    if (!isEmpty(disclosureId)) {
      return repos.disclosures.findById(disclosureId);
    }
    if (type === ExchangeTypes.DISCLOSURE) {
      throw new newError.BadRequest(ExchangeErrors.DISCLOSURE_ID_REQUIRED);
    }

    const disclosure = await repos.disclosures.findOne(
      {
        filter: {
          vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
        },
      },
      { _id: 1 }
    );

    if (isEmpty(disclosure)) {
      throw new newError.BadRequest(
        ExchangeErrors.IDENTIFICATION_DISCLOSURE_MISSING_TEMPLATE(tenant)
      );
    }
    return disclosure;
  };
};

module.exports = exchangeController;
