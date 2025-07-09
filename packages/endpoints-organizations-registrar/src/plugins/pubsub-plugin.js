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

  const baseContext = {
    config: fastify.config,
    user: null,
    log: null,
    repos: null,
    kms: null,
    serviceVersionFetch: null,
    secureMessagesFetch: null,
    betterUptimeFetch: null,
    getDocValidator: null,
    headers: null,
  };

  const pubsub = (subscriberName) => ({
    subscribe(topic, eventName, subscriber) {
      spenceSubscribe(topic, eventName, async (event) => {
        const context = structuredClone(baseContext);
        context.user = event.meta.user;
        context.log = fastify.log.child({
          msgId: event.meta.id,
          traceId: event.meta.traceId,
        });
        context.repos = event.meta.repos;
        context.serviceVersionFetch = event.meta.serviceVersionFetch;
        context.secureMessagesFetch = event.meta.secureMessagesFetch;
        context.betterUptimeFetch = event.meta.betterUptimeFetch;
        context.getDocValidator = event.meta.getDocValidator;
        context.renderTemplate = event.meta.renderTemplate;
        context.headers = event.meta.headers;
        context.kms = event.meta.kms;

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
