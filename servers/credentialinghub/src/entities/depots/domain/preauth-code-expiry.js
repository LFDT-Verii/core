/*
 * Copyright 2026 Velocity Team
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
const {
  PREAUTH_CODE_NEVER_EXPIRES,
} = require('@verii/credentialing-hub-operator-api');

// When a code made now for the depot expires: after the depot's
// preauthCodeExpiresIn, or the Hub's default for a depot without one.
// Undefined when the depot's codes never expire.
const buildPreauthCodeExpiresAt = (
  { preauthCodeExpiresIn },
  { preauthCodeExpiresInSeconds },
) => {
  const expiresIn = preauthCodeExpiresIn ?? preauthCodeExpiresInSeconds;
  return expiresIn === PREAUTH_CODE_NEVER_EXPIRES
    ? undefined
    : new Date(Date.now() + expiresIn * 1000);
};

// A code without an expiry, because its depot's codes never expire or because
// it was made before codes expired, stays valid until the depot is refreshed.
const isPreauthCodeExpired = ({ preauthCodeExpiresAt }) =>
  preauthCodeExpiresAt != null && Date.now() > preauthCodeExpiresAt.getTime();

module.exports = { buildPreauthCodeExpiresAt, isPreauthCodeExpired };
