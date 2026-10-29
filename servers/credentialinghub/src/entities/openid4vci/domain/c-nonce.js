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

const crypto = require('crypto');
const { addMilliseconds, getUnixTime } = require('date-fns');
const { jwtSign } = require('@verii/jwt');

const generateCNonce = (
  credentialIssuer,
  { config: { openid4vciNonceSecret, openid4vciNonceExpiresIn } },
) => {
  const issuedAt = new Date();
  return jwtSign({}, openid4vciNonceSecret, {
    alg: C_NONCE_ALG,
    audience: credentialIssuer,
    exp: getUnixTime(addMilliseconds(issuedAt, openid4vciNonceExpiresIn)),
    iat: getUnixTime(issuedAt),
    issuer: credentialIssuer,
    jti: crypto.randomUUID(),
  });
};

const C_NONCE_ALG = 'HS256';

module.exports = { generateCNonce };
