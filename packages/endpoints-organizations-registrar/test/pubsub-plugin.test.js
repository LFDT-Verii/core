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
 *
 */

const { after, before, describe, it, mock } = require('node:test');
const { expect } = require('expect');
const Fastify = require('fastify');
const { publish } = require('@spencejs/spence-events');
const { pubsubPlugin } = require('../src/plugins/pubsub-plugin');

describe('pubsub plugin', () => {
  const config = {
    version: '1.0.0',
    describeDeployment: () => 'Network: devnet\n',
  };
  const sendError = mock.fn();
  const subscriber = mock.fn();
  let fastify;

  before(async () => {
    fastify = Fastify();
    fastify.decorate('config', config);
    fastify.decorate('sendError', sendError);
    await fastify.register(pubsubPlugin);
    fastify
      .pubsub('testSubscriber')
      .subscribe('things', 'happened', subscriber);
    await fastify.ready();
  });

  after(async () => {
    await fastify.close();
  });

  it("should give a subscriber the server's config, functions and all", async () => {
    const user = { sub: 'auth0|123' };
    const payload = { thing: 'one' };

    await publish('things', 'happened', payload, { user, traceId: 'trace-1' });

    expect(sendError.mock.callCount()).toEqual(0);
    expect(subscriber.mock.callCount()).toEqual(1);
    const [event, context] = subscriber.mock.calls[0].arguments;
    expect(event.payload).toEqual(payload);
    expect(context.config).toBe(config);
    expect(context.user).toEqual(user);
  });
});
