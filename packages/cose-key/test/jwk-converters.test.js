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
const { generateKeyPairSync } = require('node:crypto');
const { describe, it } = require('node:test');
const { expect } = require('expect');
const {
  EC2KeyParameters,
  EllipticCurves,
  KeyParameters,
  KeyTypes,
} = require('../src/cose-iana');
const { CoseKey } = require('../src/cose-key');
const { fromJwk, toJwk } = require('../src/jwk-converters');

const es256Jwk = {
  kty: 'EC',
  x: 'kDURbHqxIXblJe6hIAlsmBhoPzbS_CumW3gP517R_cM',
  y: 'NIkFH5IHSdlppa8GzS4hxLcLpI5XaWuzdsjcvMlTcBE',
  crv: 'P-256',
};

const es256kJwk = {
  kty: 'EC',
  crv: 'secp256k1',
  x: '5YJO99LvgIY3A3pidNkk_-LBrPz8yAqpYEUQyVsszQk',
  y: 'nyuwr_sdkEZTvb2dHNNa3Ksxp-kYuxTraVI7mAFZFD0',
};

const rs256Jwk = {
  kty: 'RSA',
  // eslint-disable-next-line max-len
  n: 'sXchOWzJQX8Mmy5xkFJ8vWwOSXvNLXxkIg0FkgSsn6AyzPMZcRJPzHZjW8UdP5smN4k_0HxZY9VZJtIBaU2zUb9DdKhSbJq6q5UgZqzqNmldOBy5MOxuTxgOdxIQ9V9OLChw46wxkKjqsoKvzMGeBAIsQaXgmIkqgLf5nKr3dHgE',
  e: 'AQAB',
};

describe('jwk converters', () => {
  it('converts SECP256k1 EC key back and forth from cosekey', () => {
    const coseKey = fromJwk(es256kJwk);
    expect(toJwk(coseKey)).toEqual(es256kJwk);
  });

  it('converts P-256 EC key back and forth from cosekey', () => {
    const coseKey = fromJwk(es256Jwk);
    expect(toJwk(coseKey)).toEqual(es256Jwk);
  });

  it('converts RSA key back and forth from cosekey', () => {
    const coseKey = fromJwk(rs256Jwk);
    expect(toJwk(coseKey)).toEqual(rs256Jwk);
  });

  describe('fromJwk curve mapping', () => {
    it('encodes P-256 as COSE curve 1', () => {
      expect(fromJwk(es256Jwk).getParam(EC2KeyParameters.Crv)).toEqual(
        EllipticCurves.P_256,
      );
    });

    it('encodes secp256k1 as COSE curve 8', () => {
      expect(fromJwk(es256kJwk).getParam(EC2KeyParameters.Crv)).toEqual(
        EllipticCurves.Secp256k1,
      );
    });

    ['P-384', 'P-521'].forEach((namedCurve) => {
      it(`throws for a ${namedCurve} JWK`, () => {
        const jwk = publicEcJwk(namedCurve);
        expect(jwk.crv).toEqual(namedCurve);
        expect(() => fromJwk(jwk)).toThrow('Unsupported JWK EC Curve (crv)');
      });
    });

    [
      ['an unknown crv', 'unknown'],
      ['a crv with the wrong case', 'p-256'],
      ['a crv inherited from Object.prototype', 'constructor'],
      ['a numeric COSE crv', EllipticCurves.P_256],
      ['a null crv', null],
      ['a missing crv', undefined],
    ].forEach(([description, crv]) => {
      it(`throws for ${description}`, () => {
        expect(() => fromJwk({ ...es256Jwk, crv })).toThrow(
          'Unsupported JWK EC Curve (crv)',
        );
      });
    });
  });

  describe('toJwk curve mapping', () => {
    it('decodes COSE curve 1 as P-256', () => {
      expect(toJwk(ec2CoseKey(EllipticCurves.P_256, es256Jwk))).toEqual(
        es256Jwk,
      );
    });

    it('decodes COSE curve 8 as secp256k1', () => {
      expect(toJwk(ec2CoseKey(EllipticCurves.Secp256k1, es256kJwk))).toEqual(
        es256kJwk,
      );
    });

    [
      ['P-384', EllipticCurves.P_384],
      ['P-521', EllipticCurves.P_521],
    ].forEach(([namedCurve, coseCurve]) => {
      it(`throws for a ${namedCurve} COSE key`, () => {
        expect(() =>
          toJwk(ec2CoseKey(coseCurve, publicEcJwk(namedCurve))),
        ).toThrow('Unsupported COSE EC2 Curve (crv)');
      });
    });

    [
      ['an unknown crv', 99],
      ['the reserved crv', EllipticCurves.Reserved],
      ['an OKP crv', EllipticCurves.Ed25519],
      ['a text JWK crv', 'P-256'],
      ['a text COSE crv id', String(EllipticCurves.P_256)],
      ['a missing crv', undefined],
    ].forEach(([description, crv]) => {
      it(`throws for ${description}`, () => {
        expect(() => toJwk(ec2CoseKey(crv, es256Jwk))).toThrow(
          'Unsupported COSE EC2 Curve (crv)',
        );
      });
    });
  });
});

const publicEcJwk = (namedCurve) =>
  generateKeyPairSync('ec', { namedCurve }).publicKey.export({ format: 'jwk' });

const ec2CoseKey = (crv, jwk) =>
  new CoseKey()
    .setParam(KeyParameters.Kty, KeyTypes.EC2)
    .setParam(EC2KeyParameters.Crv, crv)
    .setParam(EC2KeyParameters.X, Buffer.from(jwk.x, 'base64url'))
    .setParam(
      EC2KeyParameters.Y,
      Buffer.from(jwk.y, 'base64url').at(-1) % 2 === 0,
    );
