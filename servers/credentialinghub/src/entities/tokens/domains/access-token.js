/*
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
 *
 */

const { find, isEmpty, startsWith } = require('lodash/fp');
const newError = require('http-errors');
const { CihKeyPurposes } = require('../../keys/domain/cih-key-purposes');

const DEFAULT_EXPIRES_IN = 10080;

const exchangePrefix = 'exchange:';
const depotPrefix = 'depot:';

const generateAccessToken = (service, exchange, { kms, tenant }) => {
  const accessTokensSecret =
    tenant.keysByPurpose[CihKeyPurposes.HOLDER_ACCESS_TOKENS];
  return kms.signJwt(
    {
      scope: [`${exchangePrefix}${exchange._id.toString()}`],
    },
    accessTokensSecret._id,
    {
      alg: 'HS384',
      issuer: tenant.did,
      subject: `${depotPrefix}${exchange.depotId.toString()}`,
      nbf: new Date(),
      expiresIn: `${service.authTokensExpireIn ?? DEFAULT_EXPIRES_IN}m`,
    },
  );
};

const verifyAccessToken = async (token, { kms, tenant }) =>
  kms.verifyJwt(
    token,
    tenant.keysByPurpose[CihKeyPurposes.HOLDER_ACCESS_TOKENS]._id,
    {
      alg: 'HS384',
      issuer: tenant.did,
    },
  );

const parseAccessToken = (token) => {
  const exchangeScope = find(startsWith(exchangePrefix), token.scope);
  const exchangeId =
    exchangeScope != null
      ? exchangeScope.substring(exchangePrefix.length)
      : undefined;
  if (isEmpty(exchangeId)) {
    throw newError(401, 'Unauthorized');
  }

  const depotId = startsWith(depotPrefix, token.sub)
    ? token.sub.substring(depotPrefix.length)
    : undefined;
  if (isEmpty(depotId)) {
    throw newError(401, 'Unauthorized');
  }
  return { exchangeId, depotId };
};

module.exports = { generateAccessToken, parseAccessToken, verifyAccessToken };
