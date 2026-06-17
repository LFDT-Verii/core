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
const { ExchangeErrors } = require('./exchange-errors');
const { ExchangeStates } = require('./exchange-states');

const validatePreauth = (preauthCode, depot, { log }) => {
  if (
    depot == null ||
    isEmpty(preauthCode) ||
    calcSha384(preauthCode) !== depot.preauthCodeHash
  ) {
    log.error(
      {
        depot,
        preauthCode,
        preauthCodeHash:
          preauthCode != null ? calcSha384(preauthCode) : undefined,
      },
      'Preauth failed',
    );
    throw newError(401, ExchangeErrors.UNAUTHORIZED, {
      exchangeErrorState: ExchangeStates.AUTHENTICATION_FAILURE,
      errorCode: ExchangeErrors.UNAUTHORIZED,
    });
  }
};

module.exports = { validatePreauth };
