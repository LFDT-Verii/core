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
const path = require('path');
const { nanoid } = require('nanoid');
const fastifyView = require('@fastify/view');
const handlebars = require('handlebars');

const rootController = async (fastify) => {
  fastify.register(fastifyView, {
    engine: {
      handlebars,
    },
    root: path.join(__dirname, '../../assets/templates'),
  });
  fastify.get(
    '/app-redirect',
    {
      schema: fastify.autoSchema({
        querystring: {
          type: 'object',
          properties: {
            deeplink: {
              type: 'string',
              format: 'uri',
            },
            openid4vc_uri: {
              type: 'string',
              format: 'uri',
            },
          },
          required: ['deeplink'],
        },
        response: {
          200: {
            description: 'deep link redirection page',
            content: {
              'text/html': { schema: { type: 'string' } },
            },
          },
        },
      }),
    },
    async (req, reply) => {
      const {
        query: { deeplink, openid4vc_uri: openid4vcUri },
      } = req;

      const { libUrl } = fastify.config;

      const scriptUrl = `${libUrl}/vnf-wallet-selection/index.js`;
      const styleSheetUrl = `${libUrl}/vnf-wallet-selection/site.css`;
      const resourceNonce = nanoid();

      const cspScriptSrc = `script-src 'nonce-${resourceNonce}';`;
      const cspStyleSrc = `style-src 'nonce-${resourceNonce}';`;
      const csp = `${cspStyleSrc} ${cspScriptSrc}`;
      reply.header('Content-Security-Policy', csp);
      return reply.view('app-redirect', {
        deeplink,
        openid4vcUri,
        scriptUrl,
        scriptNonce: resourceNonce,
        styleSheetUrl,
      });
    },
  );
};

// eslint-disable-next-line better-mutation/no-mutation
rootController.prefixOverride = '';

module.exports = rootController;
