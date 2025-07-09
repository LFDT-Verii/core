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

const { isEmpty, map } = require('lodash/fp');
const newError = require('http-errors');
const { ExchangeStates } = require('../domains');

const exchangeStateRepoExtension = (parent) => ({
  insertWithInitialState: (val, states, ...args) => {
    const timestamp = new Date();
    return parent.insert(
      {
        events: [
          {
            state: ExchangeStates.NEW,
            timestamp,
          },
          ...map((state) => ({ state, timestamp }), states),
        ],
        ...val,
      },
      ...args
    );
  },
  addState: async (
    exchangeId,
    state,
    $set,
    projection = parent.defaultColumnsSelection
  ) => {
    let updateStatement = {
      $push: { events: { state, timestamp: new Date() } },
    };
    if ($set) {
      updateStatement = {
        ...updateStatement,
        $set: parent.prepModification($set),
      };
    }
    const result = await parent
      .collection()
      .findOneAndUpdate(
        parent.prepFilter({ _id: exchangeId }),
        updateStatement,
        {
          returnDocument: 'after',
          includeResultMetadata: true,
          projection,
        }
      );

    if (isEmpty(result.value)) {
      throw newError(404, `Exchange ${exchangeId} not found`, {
        errorCode: 'exchange_not_found',
      });
    }

    return result.value;
  },
  extensions: parent.extensions.concat(['exchangeStateRepoExtension']),
});

module.exports = { exchangeStateRepoExtension };
