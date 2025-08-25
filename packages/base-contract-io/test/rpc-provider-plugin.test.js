/*
 * Copyright 2024 Velocity Team
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
const { describe, it, mock, after } = require('node:test');
const { expect } = require('expect');

mock.module('../src/contract.js', {
  namedExports: {
    initProvider: mock.fn(() => 'provider'),
  },
});

const {
  rpcProviderPlugin,
  setProvider,
} = require('../src/rpc-provider-plugin');

describe('RPC Provider Plugin', () => {
  after(() => {
    mock.reset();
  });

  it('RPC provider plugin should decorate fastify', async () => {
    const fakeServer = {
      config: { rpcUrl: 'RPC-URL' },
      decorateRequest: mock.fn(() => {}),
      addHook: mock.fn(() => {}),
    };
    rpcProviderPlugin(fakeServer);
    expect(
      fakeServer.decorateRequest.mock.calls.map((call) => call.arguments)
    ).toEqual([['rpcProvider', null]]);
    expect(fakeServer.addHook.mock.calls.map((call) => call.arguments)).toEqual(
      [['preValidation', expect.any(Function)]]
    );
  });

  it('RPC provider plugin should set provider', async () => {
    const fakeServer = {
      config: { rpcUrl: 'RPC-URL', chainId: 'CHAIN-ID' },
    };

    const fakeRequest = {};

    setProvider(fakeServer, fakeRequest);

    expect(fakeRequest.rpcProvider).toEqual('provider');
  });
});
