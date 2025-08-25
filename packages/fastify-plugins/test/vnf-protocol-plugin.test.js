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

const { beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');

const { vnfProtocolVersionPlugin } = require('../src/vnf-protocol-plugin');

describe('vnf protocol plugin tests', () => {
  it('is registered properly on the server instance', () => {
    const fakeServer = {
      decorateRequest: mock.fn(),
      addHook: mock.fn(),
    };
    vnfProtocolVersionPlugin(fakeServer, {}, () => {});
    expect(
      fakeServer.decorateRequest.mock.calls.map((call) => call.arguments)
    ).toEqual([['vnfProtocolVersion', null]]);
    expect(fakeServer.addHook.mock.calls.map((call) => call.arguments)).toEqual(
      [['onRequest', expect.any(Function)]]
    );
  });

  describe('vnf protocol plugin login tests', () => {
    let fakeServer;
    const fakeDecorateRequest = mock.fn();
    const fakeAddHook = mock.fn();
    let preHandlerFunc;
    beforeEach(() => {
      fakeDecorateRequest.mock.resetCalls();
      fakeAddHook.mock.resetCalls();
      fakeServer = {
        decorateRequest: fakeDecorateRequest,
        addHook: fakeAddHook,
      };
      vnfProtocolVersionPlugin(fakeServer, {}, () => {});
      preHandlerFunc = fakeServer.addHook.mock.calls[0].arguments[1];
    });

    it('defaults to 0 when vnf protocol header is not set', () => {
      expect(
        fakeServer.decorateRequest.mock.calls.map((call) => call.arguments)
      ).toEqual([['vnfProtocolVersion', null]]);
      const fakeReq = { headers: {} };
      preHandlerFunc(fakeReq);
      expect(fakeReq).toEqual({ headers: {}, vnfProtocolVersion: 0 });
    });

    it('defaults to 0 when vnf protocol header cannot be casted to number', () => {
      const fakeReq = {
        headers: {
          'x-vnf-protocol-version': 'foo',
        },
      };
      preHandlerFunc(fakeReq);
      expect(fakeReq).toEqual({
        headers: { 'x-vnf-protocol-version': 'foo' },
        vnfProtocolVersion: 0,
      });
    });

    it('defaults to 0 when vnf protocol header cannot almost be casted to number', () => {
      const fakeReq = {
        headers: {
          'x-vnf-protocol-version': '1.foo',
        },
      };
      preHandlerFunc(fakeReq);
      expect(fakeReq).toEqual({
        headers: { 'x-vnf-protocol-version': '1.foo' },
        vnfProtocolVersion: 0,
      });
    });

    it('sets properly when vnf protocol header is a string integer', () => {
      const fakeReq = {
        headers: {
          'x-vnf-protocol-version': '2',
        },
      };
      preHandlerFunc(fakeReq);
      expect(fakeReq).toEqual({
        headers: { 'x-vnf-protocol-version': '2' },
        vnfProtocolVersion: 2,
      });
    });
    it('sets properly when vnf protocol header is a string float', () => {
      const fakeReq = {
        headers: {
          'x-vnf-protocol-version': '2.10',
        },
      };
      preHandlerFunc(fakeReq);
      expect(fakeReq).toEqual({
        headers: { 'x-vnf-protocol-version': '2.10' },
        vnfProtocolVersion: 2.1,
      });
    });
    it('sets properly when vnf protocol header is a number integer', () => {
      const fakeReq = {
        headers: {
          'x-vnf-protocol-version': 2,
        },
      };
      preHandlerFunc(fakeReq);
      expect(fakeReq).toEqual({
        headers: { 'x-vnf-protocol-version': 2 },
        vnfProtocolVersion: 2,
      });
    });
    it('sets properly when vnf protocol header is a number float', () => {
      const fakeReq = {
        headers: {
          'x-vnf-protocol-version': 2.1,
        },
      };
      preHandlerFunc(fakeReq);
      expect(fakeReq).toEqual({
        headers: { 'x-vnf-protocol-version': 2.1 },
        vnfProtocolVersion: 2.1,
      });
    });
  });
});
