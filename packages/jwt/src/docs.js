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

const { pick } = require('lodash/fp');
const { jwkFromSecp256k1Key, jwtSign } = require('./core');

const DEFAULT_NOT_BEFORE = '0s';
const PUBLIC_JWK_PROPS = ['x', 'y', 'e', 'n', 'kty', 'crv', 'use'];

const docJti = (doc, options) => (options?.jti != null ? {} : { jti: doc.id });

const headerKey = (jwk, kid) =>
  kid != null ? { kid } : { jwk: pick(PUBLIC_JWK_PROPS, jwk) };

const generateDocJwt = (doc, key, { kid, ...options } = {}) => {
  const jwk = key.kty != null ? key : jwkFromSecp256k1Key(key);
  return jwtSign(doc, jwk, {
    nbf: DEFAULT_NOT_BEFORE,
    ...docJti(doc, options),
    ...headerKey(jwk, kid),
    ...options,
  });
};

module.exports = { docJti, generateDocJwt };
