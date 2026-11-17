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

const fp = require('fastify-plugin');
const { subscribe: spenceSubscribe } = require('@spencejs/spence-events');
const { setSelectedContext } = require('@spencejs/spence-events/src/events');

const pubsubPlugin = async (fastify) => {
  setSelectedContext([
    'user',
    'traceId',
    'repos',
    'kms',
    'betterUptimeFetch',
    'secureMessagesFetch',
    'serviceVersionFetch',
    'getDocValidator',
    'headers',
    'renderTemplate',
  ]);

  const pubsub = (subscriberName) => ({
    subscribe(topic, eventName, subscriber) {
      spenceSubscribe(topic, eventName, async (event) => {
        // A new context for each event, sharing the server's config. Cloning
        // the config would fail on the functions a server can put in it.
        const context = {
          config: fastify.config,
          user: event.meta.user,
          log: fastify.log.child({
            msgId: event.meta.id,
            traceId: event.meta.traceId,
          }),
          repos: event.meta.repos,
          kms: event.meta.kms,
          serviceVersionFetch: event.meta.serviceVersionFetch,
          secureMessagesFetch: event.meta.secureMessagesFetch,
          betterUptimeFetch: event.meta.betterUptimeFetch,
          getDocValidator: event.meta.getDocValidator,
          renderTemplate: event.meta.renderTemplate,
          headers: event.meta.headers,
        };

        try {
          await subscriber(event, context);
        } catch (error) {
          const message = `subscriber named ${subscriberName} failed`;
          context.log.error({ err: error, event, subscriberName }, message);
          fastify.sendError(error, { message, event, subscriberName });
        }
      });
      return this;
    },
  });

  fastify.decorate('pubsub', pubsub);
};

module.exports = { pubsubPlugin: fp(pubsubPlugin) };
