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

const { afterEach, describe, it } = require('node:test');
const { expect } = require('expect');

const nock = require('./helpers/nock');
const { resolveDidWeb, isWebDid } = require('../src/did-web-resolver');

const fetchFailureMessage =
  'DID must resolve to a valid https URL containing a JSON document';

describe('Did web resolver test suite', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  describe('resolveDidWeb', () => {
    it('should resolve did web', async () => {
      const did = 'did:web:nock.test';
      const nockData = nock('https://nock.test')
        .get('/.well-known/did.json')
        .reply(200, buildDidDoc(did));
      const doc = await resolveDidWeb(did);
      expect(doc).toEqual(buildDidDoc(did));
      expect(nockData.isDone()).toEqual(true);
    });

    it('should resolve did web with an encoded port and a path', async () => {
      const did = 'did:web:nock.test%3A3000:org:acme';
      const nockData = nock('https://nock.test:3000')
        .get('/org/acme/did.json')
        .reply(200, buildDidDoc(did));
      const doc = await resolveDidWeb(did);
      expect(doc).toEqual(buildDidDoc(did));
      expect(nockData.isDone()).toEqual(true);
    });

    it('should throw error if the did document id does not match the did', async () => {
      const did = 'did:web:nock.test';
      const nockData = nock('https://nock.test')
        .get('/.well-known/did.json')
        .reply(200, buildDidDoc('did:web:other.test'));
      await expect(resolveDidWeb(did)).rejects.toMatchObject(
        resolutionError(
          `Could not resolve ${did}: DID document id does not match requested did`,
        ),
      );
      expect(nockData.isDone()).toEqual(true);
    });

    it('should throw error if a did url with a query resolves to a document identified by the bare did', async () => {
      const did = 'did:web:nock.test?version=1';
      const nockData = nock('https://nock.test')
        .get('/.well-known/did.json')
        .reply(200, buildDidDoc('did:web:nock.test'));
      await expect(resolveDidWeb(did)).rejects.toMatchObject(
        resolutionError(
          `Could not resolve ${did}: DID document id does not match requested did`,
        ),
      );
      expect(nockData.isDone()).toEqual(true);
    });

    it('should throw error if the did document is not found', async () => {
      const did = 'did:web:nock.test';
      const nockData = nock('https://nock.test')
        .get('/.well-known/did.json')
        .reply(404);
      await expect(resolveDidWeb(did)).rejects.toMatchObject(
        resolutionError(`Could not resolve ${did}: ${fetchFailureMessage}`),
      );
      expect(nockData.isDone()).toEqual(true);
    });

    it('should throw error without network details if the did document host is unreachable', async () => {
      const did = 'did:web:nock.test';
      const nockData = nock('https://nock.test')
        .get('/.well-known/did.json')
        .replyWithError('connect ECONNREFUSED 10.0.0.1:443');
      await expect(resolveDidWeb(did)).rejects.toMatchObject(
        resolutionError(`Could not resolve ${did}: ${fetchFailureMessage}`),
      );
      expect(nockData.isDone()).toEqual(true);
    });

    it('should throw error without the response body if the did document is not json', async () => {
      const did = 'did:web:nock.test';
      const nockData = nock('https://nock.test')
        .get('/.well-known/did.json')
        .reply(200, '<html>internal page</html>');
      await expect(resolveDidWeb(did)).rejects.toMatchObject(
        resolutionError(`Could not resolve ${did}: ${fetchFailureMessage}`),
      );
      expect(nockData.isDone()).toEqual(true);
    });

    it('should throw error if the did is invalid', async () => {
      await expect(resolveDidWeb('did:web:')).rejects.toMatchObject(
        resolutionError('Could not resolve did:web:: invalidDid'),
      );
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

const buildDidDoc = (id) => ({
  '@context': [
    'https://www.w3.org/ns/did/v1',
    'https://w3id.org/security/suites/jws-2020/v1',
  ],
  id,
  verificationMethod: [],
  authentication: [`${id}#owner`],
  assertionMethod: [`${id}#owner`],
});

const resolutionError = (message) => ({
  status: 400,
  errorCode: 'did_resolution_failed',
  message,
});
