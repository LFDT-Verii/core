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

const { addMilliseconds, getUnixTime } = require('date-fns');
const { nanoid } = require('nanoid');
const { CihKeyPurposes } = require('../../keys');

const generateIssuingChallenge = async (
  exchangeId,
  { kms, tenant, config: { challengesExpireIn: challengesExpireInMs } },
) => {
  const challengeIssuedAt = new Date();
  const challengeIssuedAtUnix = getUnixTime(challengeIssuedAt);
  const challengeExpiresAtUnix = getUnixTime(
    addMilliseconds(challengeIssuedAt, challengesExpireInMs),
  );

  return {
    challenge: await kms.signJwt(
      { exchangeId: exchangeId.toString() },
      tenant.keysByPurpose[CihKeyPurposes.HOLDER_ACCESS_TOKENS]._id,
      {
        alg: 'HS256',
        audience: tenant.hostUrl,
        exp: challengeExpiresAtUnix,
        iat: challengeIssuedAtUnix,
        issuer: tenant.hostUrl,
        jti: nanoid(),
      },
    ),
  };
};

module.exports = { generateIssuingChallenge };
