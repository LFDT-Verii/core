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

const { describe, it } = require('node:test');
const { expect } = require('expect');

/* eslint-disable max-len */
const { generateKeyPair, exportJWK } = require('jose');

const {
  getDidUriFromJwk,
  getDidJwkDocument,
  getJwkFromDidUri,
  resolveDidJwkDocument,
} = require('../src/did-jwk');

describe('did-jwt', () => {
  const es256PublicJwk = {
    crv: 'P-256',
    ext: false,
    x: 'Sp3KpzPjwcCF04_W2GvSSf-vGDvp3Iv2kQYqAjnMB-Y',
    y: 'lZmecT2quXe0i9f7b4qHvDAFDpxs0oxCoJx4tOOqsks',
    kty: 'EC',
  };

  const es256DidUri =
    'did:jwk:eyJjcnYiOiJQLTI1NiIsImV4dCI6ZmFsc2UsImt0eSI6IkVDIiwieCI6IlNwM0twelBqd2NDRjA0X1cyR3ZTU2YtdkdEdnAzSXYya1FZcUFqbk1CLVkiLCJ5IjoibFptZWNUMnF1WGUwaTlmN2I0cUh2REFGRHB4czBveENvSng0dE9PcXNrcyJ9';

  const es256KPublicJwk = {
    crv: 'secp256k1',
    x: 'KfF0wv4Hp1WB0BumrRSOEowMEUebJYmTsDal8gg0cto',
    y: 'IjZyg3bCNFdzXdRPMnYp7LVcdQ_wfCV9d5IbRoVjYDs',
    kty: 'EC',
  };
  const scrambledEs256KPublicJwk = {
    kty: 'EC',
    crv: 'secp256k1',
    x: 'KfF0wv4Hp1WB0BumrRSOEowMEUebJYmTsDal8gg0cto',
    y: 'IjZyg3bCNFdzXdRPMnYp7LVcdQ_wfCV9d5IbRoVjYDs',
  };

  const es256kDidUri =
    'did:jwk:eyJjcnYiOiJzZWNwMjU2azEiLCJrdHkiOiJFQyIsIngiOiJLZkYwd3Y0SHAxV0IwQnVtclJTT0Vvd01FVWViSlltVHNEYWw4Z2cwY3RvIiwieSI6IklqWnlnM2JDTkZkelhkUlBNbllwN0xWY2RRX3dmQ1Y5ZDVJYlJvVmpZRHMifQ';

  it('should convert jwks to uris consistently', () => {
    expect(getDidUriFromJwk(es256PublicJwk)).toEqual(es256DidUri);
    expect(getDidUriFromJwk(es256KPublicJwk)).toEqual(es256kDidUri);
    expect(getDidUriFromJwk(scrambledEs256KPublicJwk)).toEqual(es256kDidUri);
  });

  it('should be able to create ed25519 jwks', async () => {
    const keyPair = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
    const publicKey = await exportJWK(keyPair.publicKey);
    expect(getDidUriFromJwk(publicKey)).toMatch(
      /did:jwk:eyJjcnYiOiJFZDI1NTE5Iiwia3.*/
    );
  });

  it('should be able to create ES256 jwks', async () => {
    const keyPair = await generateKeyPair('ES256');
    const publicKey = await exportJWK(keyPair.publicKey);
    expect(getDidUriFromJwk(publicKey)).toMatch(
      /did:jwk:eyJjcnYiOiJQLTI1NiIsIm.*/
    );
  });

  it('should convert jwks to did documents', async () => {
    expect(await getDidJwkDocument(es256PublicJwk)).toEqual(
      expectedDidDoc(es256DidUri, es256PublicJwk)
    );
    expect(await getDidJwkDocument(es256KPublicJwk)).toEqual(
      expectedDidDoc(es256kDidUri, es256KPublicJwk)
    );
    expect(await getDidJwkDocument(scrambledEs256KPublicJwk)).toEqual(
      expectedDidDoc(es256kDidUri, es256KPublicJwk)
    );
  });

  it('should convert did uris to jwks', async () => {
    expect(() => getJwkFromDidUri('blah')).toThrow(Error);
    expect(() => getJwkFromDidUri('did:key;43536')).toThrow(Error);
    expect(getJwkFromDidUri(es256DidUri)).toEqual(es256PublicJwk);
    expect(getJwkFromDidUri(es256kDidUri)).toEqual(es256KPublicJwk);
    expect(getJwkFromDidUri(`${es256kDidUri}#0`)).toEqual(es256KPublicJwk);
  });

  it('should resolve did uris to did documents', async () => {
    expect(await resolveDidJwkDocument(es256DidUri)).toEqual(
      expectedDidDoc(es256DidUri, es256PublicJwk)
    );
    expect(await resolveDidJwkDocument(es256kDidUri)).toEqual(
      expectedDidDoc(es256kDidUri, es256KPublicJwk)
    );
  });
});

const expectedDidDoc = (uri, jwk) => ({
  '@context': [
    'https://www.w3.org/ns/did/v1',
    {
      '@vocab': 'https://www.iana.org/assignments/jose#',
    },
  ],
  id: uri,
  verificationMethod: [
    {
      controller: uri,
      id: '#0',
      publicKeyJwk: jwk,
      type: 'JsonWebKey2020',
    },
  ],
});
