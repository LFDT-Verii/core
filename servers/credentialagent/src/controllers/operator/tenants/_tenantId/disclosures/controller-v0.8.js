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

const { getOrganizationVerifiedProfile } = require('@verii/common-fetchers');
const {
  setTenantDefaultIssuingDisclosure,
  validateDisclosure,
  parseBodyToDisclosure,
} = require('../../../../../entities');

const operatorDisclosuresController = async (fastify) => {
  fastify.get(
    '/',
    {
      schema: fastify.autoSchema({
        query: {
          type: 'object',
          properties: {
            vendorEndpoint: { type: 'array', items: { type: 'string' } },
          },
        },
        response: {
          200: {
            type: 'array',
            items: {
              $ref: 'https://velocitycareerlabs.io/agent-disclosure-v0.8.schema.json#',
            },
          },
        },
      }),
    },
    async (req) => {
      const filter = {};
      if (req.query.vendorEndpoint) {
        filter.vendorEndpoint = { $in: req.query.vendorEndpoint };
      }
      return req.repos.disclosures.find({ filter });
    }
  );

  fastify.post(
    '/',
    {
      schema: fastify.autoSchema({
        body: {
          allOf: [
            {
              $ref: 'https://velocitycareerlabs.io/new-agent-disclosure.schema.json#',
            },
            {
              type: 'object',
              properties: {
                setIssuingDefault: {
                  type: 'boolean',
                },
              },
            },
          ],
        },
        response: {
          201: {
            $ref: 'https://velocitycareerlabs.io/agent-disclosure-v0.8.schema.json#',
          },
        },
      }),
    },
    async (req, reply) => {
      const { repos, body, tenant } = req;
      const { setIssuingDefault } = body;
      const disclosure = parseBodyToDisclosure(body, req);
      const verifiedProfile = await getOrganizationVerifiedProfile(
        tenant.did,
        req
      );
      validateDisclosure(disclosure, verifiedProfile, setIssuingDefault, req);
      const newDisclosure = await repos.disclosures.insert(disclosure);
      await setTenantDefaultIssuingDisclosure(
        { disclosure: newDisclosure, setIssuingDefault },
        req
      );
      reply.code(201);
      return newDisclosure;
    }
  );
};

module.exports = operatorDisclosuresController;
