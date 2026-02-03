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

const createError = require('http-errors');
const {
  getCountries,
  isLanguageCodeValid,
  isLanguageSupported,
} = require('@verii/country-data');
const {
  CachingConstants,
} = require('@verii/endpoints-credential-types-registrar');

const DEFAULT_LANGUAGE_CODE_FALLBACK = 'en';

const countriesController = async (fastify) => {
  fastify.get(
    '/countries',
    {
      schema: fastify.autoSchema({
        querystring: {
          type: 'object',
          properties: {
            lge: { type: 'string', description: 'Language' },
          },
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description:
                    'The name of the country in the language of the "lge" query parameter',
                },
                code: {
                  type: 'string',
                  description: 'The ISO 3166-1 country code',
                },
                regions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: {
                        type: 'string',
                        description:
                          'The name of the subdivision in the language of the "lge" query parameter',
                      },
                      code: {
                        type: 'string',
                        description: 'The ISO 3166-2 subdivision code',
                      },
                    },
                    required: ['name', 'code'],
                  },
                },
              },
              required: ['name', 'code', 'regions'],
            },
          },
        },
      }),
    },
    async ({ query: { lge } }, reply) => {
      if (lge != null && !isLanguageCodeValid(lge)) {
        throw createError(400, '"lge" query parameter is malformed');
      }
      const selectedLge =
        lge != null && isLanguageSupported(lge)
          ? lge
          : DEFAULT_LANGUAGE_CODE_FALLBACK;
      const countries = await getCountries(selectedLge);
      return reply
        .header(
          CachingConstants.CACHE_CONTROL_HEADER,
          CachingConstants.MAX_AGE_CACHE_CONTROL,
        )
        .send(countries);
    },
  );
};

// eslint-disable-next-line better-mutation/no-mutation
countriesController.prefixOverride = '/reference';

module.exports = countriesController;
