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

const { KeyPurposes } = require('@verii/crypto');
const { nanoid } = require('nanoid');

const generateAccessToken = (
  id,
  subject,
  disclosure,
  exchange,
  { kms, tenant, tenantKeysByPurpose, config }
) => {
  const accessTokensSecret = tenantKeysByPurpose[KeyPurposes.EXCHANGES];
  return kms.signJwt({}, accessTokensSecret.keyId, {
    jti: id == null ? nanoid(16) : id.toString(),
    issuer: tenant.did,
    audience: tenant.did,
    kid: accessTokensSecret.kidFragment,
    subject,
    nbf: new Date(),
    expiresIn: disclosure?.authTokensExpireIn
      ? `${disclosure?.authTokensExpireIn}m`
      : config.defaultOAuthTokenExpiration,
  });
};

const verifyAccessToken = async (token, { kms, tenant, tenantKeysByPurpose }) =>
  kms.verifyJwt(token, tenantKeysByPurpose[KeyPurposes.EXCHANGES].keyId, {
    issuer: tenant.did,
    audience: tenant.did,
    requiredClaims: ['sub', 'aud', 'iss'],
  });

module.exports = { generateAccessToken, verifyAccessToken };
