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

const { jwtSign } = require('@verii/jwt');
const { getUnixTime } = require('date-fns/fp');
const { nanoid } = require('nanoid');

const generateTestAccessToken = (
  id,
  issuer,
  subject,
  scope,
  payload,
  expiresIn,
  exp,
  privateKey,
  kid
) => {
  const tokenPayload = payload != null ? { ...payload } : {};
  if (scope != null) {
    tokenPayload.scope = scope;
  }
  const t = getUnixTime(new Date());
  const options = {
    iat: t,
    nbf: t,
    jti: id == null ? nanoid(16) : id.toString(),
    issuer,
    subject,
    audience: issuer,
    expiresIn,
    exp,
  };
  if (kid != null) {
    options.kid = kid;
  }
  return jwtSign(tokenPayload, privateKey, options);
};

module.exports = { generateTestAccessToken };
