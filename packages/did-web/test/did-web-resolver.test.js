/**
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
 */

const { describe, it } = require('node:test');
const { expect } = require('expect');

const nock = require('nock');
const newError = require('http-errors');
const { resolveDidWeb, isWebDid } = require('../src/did-web-resolver');

describe('Did web resolver test suite', () => {
  describe('resolveDidWeb', () => {
    it('should throw error if did is not resolved', async () => {
      const did = 'did:web:unknown';
      await expect(() => resolveDidWeb(did)).rejects.toThrowError(
        newError(400, `Could not resolve ${did}`, {
          errorCode: 'did_resolution_failed',
        })
      );
    });

    it('should resolve did web', async () => {
      const nockData = nock('https://nock.test')
        .get('/.well-known/did.json')
        .reply(200, {
          '@context': [
            'https://www.w3.org/ns/did/v1',
            'https://w3id.org/security/suites/jws-2020/v1',
          ],
          id: 'did:web:nock.test',
          verificationMethod: [],
          authentication: ['did:web:nock.test#owner'],
          assertionMethod: ['did:web:nock.test#owner'],
        });
      const did = 'did:web:nock.test';
      const doc = await resolveDidWeb(did);
      expect(doc).toBeDefined();
      expect(doc.id).toBe(did);
      expect(nockData.isDone()).toEqual(true);
    });
  });

  describe('isWebDid', () => {
    it('should return true if did is web', () => {
      const did = 'did:web:nock.test';
      expect(isWebDid(did)).toEqual(true);
    });

    it('should return false if did is not web', () => {
      const did = 'did:ion:nock.test';
      expect(isWebDid(did)).toEqual(false);
    });
  });
});
