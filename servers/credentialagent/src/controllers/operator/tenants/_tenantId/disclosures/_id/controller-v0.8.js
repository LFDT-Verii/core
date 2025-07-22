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

const { ObjectId } = require('mongodb');
const qr = require('qr-image');
const newError = require('http-errors');
const { getOrganizationVerifiedProfile } = require('@verii/common-fetchers');
const {
  buildDisclosureRequestDeepLink,
  velocityProtocolUriToHttpUri,
  setTenantDefaultIssuingDisclosure,
  validateDisclosure,
  parseBodyToDisclosure,
} = require('../../../../../../entities');

const operatorDisclosuresController = async (fastify) => {
  const specificParams = {
    type: 'object',
    properties: {
      id: { type: 'string', minLength: 1 },
      ...fastify.currentAutoSchemaPreset.params.properties,
    },
  };

  const qrCodeQueryString = {
    type: 'object',
    properties: { vendorOriginContext: { type: 'string' } },
  };

  fastify.get(
    '/',
    {
      schema: fastify.autoSchema({
        params: specificParams,
        response: {
          200: {
            $ref: 'https://velocitycareerlabs.io/agent-disclosure-v0.8.schema.json#',
          },
        },
      }),
    },
    async ({ repos, params: { id } }) => repos.disclosures.findById(id)
  );

  fastify.put(
    '/',
    {
      schema: fastify.autoSchema({
        params: specificParams,
        body: {
          $ref: 'https://velocitycareerlabs.io/update-agent-disclosure.schema.json#',
        },
        response: {
          200: {
            $ref: 'https://velocitycareerlabs.io/agent-disclosure-v0.8.schema.json#',
          },
        },
      }),
    },
    async (req) => {
      const {
        repos,
        body,
        tenant,
        params: { id },
      } = req;
      const { setIssuingDefault } = body;
      const disclosure = parseBodyToDisclosure(body, req);
      const verifiedProfile = await getOrganizationVerifiedProfile(
        tenant.did,
        req
      );
      validateDisclosure(disclosure, verifiedProfile, setIssuingDefault, req);
      const updatedDisclosure = await repos.disclosures.updateDisclosure({
        id,
        body: disclosure,
      });
      await setTenantDefaultIssuingDisclosure(
        {
          disclosure: updatedDisclosure,
          setIssuingDefault,
        },
        req
      );
      return updatedDisclosure;
    }
  );

  fastify.delete(
    '/',
    {
      schema: fastify.autoSchema({
        params: specificParams,
        response: {
          204: { type: 'null', description: 'No Content' },
          400: {
            $ref: 'error#',
          },
        },
      }),
    },
    async (req, reply) => {
      const {
        repos,
        params: { id },
      } = req;
      const [tenant, feed] = await Promise.all([
        repos.tenants.findOne({
          filter: {
            defaultIssuingDisclosureId: new ObjectId(id),
          },
        }),
        repos.feeds.findOne({
          filter: {
            disclosureId: new ObjectId(id),
          },
        }),
      ]);

      if (tenant != null) {
        throw newError(400, 'Disclosure cannot be deleted', {
          errorCode: 'default_disclosure_cannot_be_deleted',
        });
      }

      if (feed != null) {
        throw newError(400, 'Disclosure cannot be deleted', {
          errorCode: 'disclosure_with_feeds_cannot_be_deleted',
        });
      }

      await repos.disclosures.del(id);
      reply.code(204);
    }
  );

  fastify.get(
    '/deep-link',
    {
      schema: fastify.autoSchema({
        params: specificParams,
        querystring: {
          type: 'object',
          properties: {
            vendorOriginContext: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: { deepLink: { type: 'string' } },
            required: ['deepLink'],
          },
        },
      }),
    },
    async (req) => {
      const { query } = req;
      const disclosureDeepLink = await handleDeepLinkRequest(
        {
          disclosureId: req.params.id,
          vendorOriginContext: query.vendorOriginContext,
        },
        req
      );
      const httpProtocolDeepLink = velocityProtocolUriToHttpUri(
        disclosureDeepLink,
        req
      );
      return { deepLink: httpProtocolDeepLink };
    }
  );

  fastify.get(
    '/qrcode.png',
    {
      schema: fastify.autoSchema({
        params: specificParams,
        querystring: qrCodeQueryString,
        response: {
          200: {
            description: 'qr code image response',
            content: {
              'image/png': { schema: { type: 'string', format: 'binary' } },
            },
          },
        },
      }),
    },
    async (req, reply) => {
      const {
        params: { id },
        query: { vendorOriginContext },
      } = req;

      const uri = await handleDeepLinkRequest(
        { disclosureId: id, vendorOriginContext },
        req
      );

      const qrCodeBuffer = qr.imageSync(uri, {
        ec_level: 'H',
        type: 'png',
      });

      return reply.type('image/png').send(qrCodeBuffer);
    }
  );
  fastify.get(
    '/qrcode.uri',
    {
      schema: fastify.autoSchema({
        params: specificParams,
        querystring: qrCodeQueryString,
        response: {
          200: {
            description: 'qr code deep link',
            content: {
              'text/plain': { schema: { type: 'string', format: 'uri' } },
            },
          },
        },
      }),
    },
    async (req, reply) => {
      const {
        params: { id },
        query: { vendorOriginContext },
      } = req;

      const uri = await handleDeepLinkRequest(
        { disclosureId: id, vendorOriginContext },
        req
      );

      return reply.type('text/plain').send(uri);
    }
  );
};

const handleDeepLinkRequest = async (
  { disclosureId, vendorOriginContext },
  context
) => {
  const { repos } = context;
  // load disclosure to make sure it exists
  const disclosure = await repos.disclosures.findById(disclosureId, {
    _id: 1,
    vendorEndpoint: 1,
  });
  return buildDisclosureRequestDeepLink(
    disclosure,
    vendorOriginContext,
    context
  );
};

module.exports = operatorDisclosuresController;
