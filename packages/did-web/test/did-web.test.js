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
const { uriToDidWeb } = require('../src/did-web');

describe('Did Web test suite', () => {
  describe('uriToDidWeb test suite', () => {
    it('should create a did:web with just a domain', async () => {
      const uri = 'http://example.com';
      const did = uriToDidWeb(uri);
      expect(did).toEqual('did:web:example.com');
    });
    it('should create a did:web with just a domain and a trailing slash', async () => {
      const uri = 'http://example.com/';
      const did = uriToDidWeb(uri);
      expect(did).toEqual('did:web:example.com');
    });
    it('should create a did:web with a domain with a port', async () => {
      const uri = 'http://example.com:1234';
      const did = uriToDidWeb(uri);
      expect(did).toEqual('did:web:example.com%3A1234');
    });
    it('should create a did:web with a domain with a path', async () => {
      const uri = 'http://example.com/foo/bar';
      const did = uriToDidWeb(uri);
      expect(did).toEqual('did:web:example.com:foo:bar');
    });
    it('should create a did:web with a domain with an encoded subpath', async () => {
      const uri = 'http://example.com/foo/bar+foo';
      const did = uriToDidWeb(uri);
      expect(did).toEqual('did:web:example.com:foo:bar%2Bfoo');
    });
    it('should create a did:web with a domain with a port and a path', async () => {
      const uri = 'http://example.com:1234/foo/bar';
      const did = uriToDidWeb(uri);
      expect(did).toEqual('did:web:example.com%3A1234:foo:bar');
    });
  });
});
