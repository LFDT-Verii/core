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
const { isEmpty } = require('lodash/fp');
const newError = require('http-errors');
const { calcSha384 } = require('@verii/crypto');
const {
  isPreauthCodeExpired,
} = require('../../depots/domain/preauth-code-expiry');
const { ExchangeErrors } = require('./exchange-errors');
const { ExchangeStates } = require('./exchange-states');

// A code is checked against its depot's current code first, so only the
// holder of that code learns that it has expired.
const validatePreauth = (preauthCode, depot, { log }) => {
  if (!isDepotPreauthCode(preauthCode, depot)) {
    log.error(
      {
        depotId: depot?._id,
        preauthCodeHash:
          preauthCode != null ? calcSha384(preauthCode) : undefined,
      },
      'Preauth failed',
    );
    throw preauthError(ExchangeErrors.UNAUTHORIZED);
  }
  if (isPreauthCodeExpired(depot)) {
    log.warn(
      {
        depotId: depot._id,
        preauthCodeExpiresAt: depot.preauthCodeExpiresAt,
      },
      'Preauth code expired',
    );
    throw preauthError(ExchangeErrors.PREAUTH_CODE_EXPIRED);
  }
};

const isDepotPreauthCode = (preauthCode, depot) =>
  depot != null &&
  !isEmpty(preauthCode) &&
  calcSha384(preauthCode) === depot.preauthCodeHash;

const preauthError = (errorCode) =>
  newError(401, errorCode, {
    exchangeErrorState: ExchangeStates.AUTHENTICATION_FAILURE,
    errorCode,
  });

module.exports = { validatePreauth };
