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

const { CihKeyPurposes } = require('../../keys');

const verifyIssuingChallenge = async (
  challenge,
  exchangeId,
  { kms, tenant },
) => {
  const { payload } = await kms.verifyJwt(
    challenge,
    tenant.keysByPurpose[CihKeyPurposes.HOLDER_ACCESS_TOKENS]._id,
    {
      alg: 'HS256',
      audience: tenant.hostUrl,
      issuer: tenant.hostUrl,
    },
  );

  if (payload.exchangeId !== exchangeId.toString()) {
    throw new Error('challenge_exchange_mismatch');
  }

  return payload;
};

module.exports = { verifyIssuingChallenge };
