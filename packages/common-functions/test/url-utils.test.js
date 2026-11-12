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
const { describe, it } = require('node:test');
const { expect } = require('expect');

const {
  appendSearchParam,
  appendSearchParamArray,
  buildAgentHolderUrl,
  buildDeepLink,
} = require('../src/url-utils');

describe('url utils', () => {
  describe('buildAgentHolderUrl', () => {
    it('should build the holder api url of an organization', () => {
      const url = buildAgentHolderUrl(
        'https://agent.example.com',
        'did:web:example.com',
        'issue/get-credential-manifest',
      );
      expect(url).toBeInstanceOf(URL);
      expect(url.href).toEqual(
        'https://agent.example.com/api/holder/v0.6/org/did:web:example.com/issue/get-credential-manifest',
      );
    });
    it('should keep a path on the host url', () => {
      expect(
        buildAgentHolderUrl(
          'https://agent.example.com/acme',
          'did:ion:123',
          'get-exchange-progress',
        ).href,
      ).toEqual(
        'https://agent.example.com/acme/api/holder/v0.6/org/did:ion:123/get-exchange-progress',
      );
    });
    it('should not encode the did', () => {
      expect(
        buildAgentHolderUrl(
          'https://agent.example.com',
          'did:web:example.com%3A3000',
          'inspect/get-presentation-request',
        ).href,
      ).toEqual(
        'https://agent.example.com/api/holder/v0.6/org/did:web:example.com%3A3000/inspect/get-presentation-request',
      );
    });
    it('should accept search params with appendSearchParam', () => {
      expect(
        appendSearchParam(
          'id',
          '123',
        )(
          buildAgentHolderUrl(
            'https://agent.example.com',
            'did:ion:123',
            'inspect/get-presentation-request',
          ),
        ).href,
      ).toEqual(
        'https://agent.example.com/api/holder/v0.6/org/did:ion:123/inspect/get-presentation-request?id=123',
      );
    });
  });
  describe('buildDeepLink', () => {
    const requestUri =
      'https://agent.example.com/api/holder/v0.6/org/did:ion:123/issue/get-credential-manifest?id=1&credential_types=Email&credential_types=Phone';

    it('should build a deep link with one link', () => {
      const url = buildDeepLink('velocity-network://', 'issue', {
        requestUri,
        inspectorDid: 'did:ion:inspector',
        issuerDid: 'did:ion:issuer',
        vendorOriginContext: 'abc',
      });
      expect(url).toBeInstanceOf(URL);
      expect(url.href).toEqual(
        'velocity-network://issue' +
          `?request_uri=${encodeURIComponent(requestUri)}` +
          '&inspectorDid=did%3Aion%3Ainspector' +
          '&issuerDid=did%3Aion%3Aissuer' +
          '&vendorOriginContext=abc',
      );
    });
    it('should build a deep link with several links', () => {
      const url = buildDeepLink('velocity-network://', 'inspect', [
        {
          requestUri: 'https://a.example.com/1',
          inspectorDid: 'did:ion:1',
          vendorOriginContext: 'ctx1',
        },
        { requestUri: 'https://a.example.com/2', inspectorDid: 'did:ion:2' },
      ]);
      expect(url.href).toEqual(
        'velocity-network://inspect' +
          '?request_uri=https%3A%2F%2Fa.example.com%2F1' +
          '&inspectorDid=did%3Aion%3A1' +
          '&vendorOriginContext=ctx1' +
          '&request_uri=https%3A%2F%2Fa.example.com%2F2' +
          '&inspectorDid=did%3Aion%3A2',
      );
    });
    it('should leave out unset params', () => {
      expect(
        buildDeepLink('velocity-network://', 'issue', {
          requestUri,
          inspectorDid: null,
          issuerDid: 'did:ion:issuer',
        }).href,
      ).toEqual(
        `velocity-network://issue?request_uri=${encodeURIComponent(
          requestUri,
        )}&issuerDid=did%3Aion%3Aissuer`,
      );
    });
    it('should encode request_uri once', () => {
      const url = buildDeepLink('velocity-network://', 'issue', {
        requestUri: new URL(requestUri),
      });
      expect(url.searchParams.get('request_uri')).toEqual(requestUri);
    });
    it('should put vendorOriginContext on the deep link, not inside request_uri', () => {
      const url = buildDeepLink('velocity-network://', 'issue', {
        requestUri,
        vendorOriginContext: 'abc',
      });
      expect(url.searchParams.get('vendorOriginContext')).toEqual('abc');
      expect(
        new URL(url.searchParams.get('request_uri')).searchParams.has(
          'vendorOriginContext',
        ),
      ).toEqual(false);
    });
  });
  describe('appendSearchParam', () => {
    it('should append params', () => {
      expect(
        appendSearchParam('a', 1)(new URL('http://example.com/path')).href,
      ).toEqual('http://example.com/path?a=1');
    });
  });
  describe('appendSearchParamArray', () => {
    it('should append array params', () => {
      expect(
        appendSearchParamArray('a', [1, 2])(new URL('http://example.com/path'))
          .href,
      ).toEqual('http://example.com/path?a=1&a=2');
    });
  });
});
