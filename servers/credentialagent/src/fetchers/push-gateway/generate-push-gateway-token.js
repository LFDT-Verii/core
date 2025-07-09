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

const canonicalize = require('canonicalize');
const { KeyPurposes, createCommitment } = require('@verii/crypto');
const { toDidUrl } = require('@verii/did-doc');

const generatePushGatewayToken = async (body, pushUrl, context) => {
  const audience = new URL(pushUrl).origin;
  const { tenant, tenantKeysByPurpose, traceId, kms } = context;

  const hash = createCommitment(canonicalize(body));
  const exchangesKey = tenantKeysByPurpose[KeyPurposes.EXCHANGES];
  const token = await kms.signJwt({ hash }, exchangesKey.keyId, {
    subject: body.data.exchangeId,
    audience,
    jti: traceId,
    issuer: tenant.did,
    kid: toDidUrl(tenant.did, exchangesKey.kidFragment),
    nbf: new Date(),
    expiresIn: '1w',
  });

  return `Bearer ${token}`;
};

module.exports = { generatePushGatewayToken };
