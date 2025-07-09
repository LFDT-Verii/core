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

const fp = require('fastify-plugin');
const { ExchangeStates } = require('../entities');

const exchangeErrorHandlerPlugin = (fastify, options, next) => {
  fastify.addHook('onError', async (req, reply, err) => {
    const { repos, exchange, log } = req;
    try {
      if (!exchange || err.statusCode === 409) {
        return;
      }
      await repos.exchanges.addState(
        exchange._id,
        calcExchangeErrorState(err.exchangeErrorState, err.statusCode),
        {
          err: err.message,
        }
      );
    } catch (dbError) {
      log.error(dbError, 'DB Error when setting error state');
    }
  });
  next();
};

const calcExchangeErrorState = (exchangeErrorState, statusCode) => {
  if (exchangeErrorState) {
    return exchangeErrorState;
  }
  if (statusCode === 401) {
    return ExchangeStates.NOT_IDENTIFIED;
  }

  return ExchangeStates.UNEXPECTED_ERROR;
};
module.exports = { exchangeErrorHandlerPlugin: fp(exchangeErrorHandlerPlugin) };
