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
const { toDidUrl } = require('@verii/did-doc');
const newError = require('http-errors');

const signExchangeResponse = async (
  exchangeResponse,
  // eslint-disable-next-line default-param-last
  options = {},
  { kms, tenant, tenantKeysByPurpose },
) => {
  const exchangesKey = tenantKeysByPurpose[KeyPurposes.EXCHANGES];
  if (exchangesKey == null) {
    throw newError(
      500,
      `No key matching the filter {"tenantId":"${tenant._id}","purposes":"EXCHANGES"} was found`,
      { errorCode: 'tenant_exchanges_key_missing' },
    );
  }
  return kms.signJwt(exchangeResponse, exchangesKey.keyId, {
    jti: exchangeResponse.id,
    issuer: tenant.did,
    kid: toDidUrl(tenant.did, exchangesKey.kidFragment),
    nbf: new Date(),
    expiresIn: '1w',
    ...options,
  });
};

module.exports = { signExchangeResponse };
