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
});
