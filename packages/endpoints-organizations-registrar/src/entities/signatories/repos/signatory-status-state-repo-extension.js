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

const { map, isPlainObject, includes } = require('lodash/fp');
const { ObjectId } = require('mongodb');
const { SignatoryEventStatus } = require('../domain');

const signatoryStatusStateRepoExtension = (parent) => ({
  insertWithState: ({ states, authCode, ...val }, ...args) => {
    const timestamp = new Date();
    return parent.insert(
      {
        events: [...map((state) => ({ state, timestamp }), states)],
        authCodes: [{ code: authCode, timestamp }],
        ...val,
      },
      ...args
    );
  },
  addState: async (
    _idOrFilter,
    state,
    $set,
    projection = parent.defaultColumnsSelection
  ) => {
    const eventsArr = [{ state, timestamp: new Date() }];
    if (
      includes(state, [
        SignatoryEventStatus.APPROVED,
        SignatoryEventStatus.REJECTED,
        SignatoryEventStatus.MAX_REACHED,
      ])
    ) {
      eventsArr.push({
        state: SignatoryEventStatus.COMPLETED,
        timestamp: new Date(),
      });
    }
    let updateStatement = {
      $push: { events: { $each: eventsArr } },
    };
    if ($set) {
      updateStatement = {
        ...updateStatement,
        $set: parent.prepModification($set),
      };
    }
    const filter = isPlainObject(_idOrFilter)
      ? _idOrFilter
      : { _id: new ObjectId(_idOrFilter) };

    const result = await parent
      .collection()
      .findOneAndUpdate(parent.prepFilter(filter), updateStatement, {
        returnDocument: 'after',
        includeResultMetadata: true,
        projection,
      });
    return result.value;
  },
  addStateAndCode: async (
    _id,
    state,
    authCode,
    projection = parent.defaultColumnsSelection
  ) => {
    const timestamp = new Date();
    const result = await parent.collection().findOneAndUpdate(
      parent.prepFilter({ _id: new ObjectId(_id) }),
      {
        $push: {
          events: { state, timestamp },
          authCodes: { code: authCode, timestamp },
        },
      },
      {
        returnDocument: 'after',
        includeResultMetadata: true,
        projection,
      }
    );
    return result.value;
  },
  findByEvent: async (eventTimestamp) => {
    const aggregationPipeline = [
      {
        $match: {
          'events.state': {
            $ne: SignatoryEventStatus.COMPLETED,
          },
        },
      },
      {
        $addFields: {
          latestEvent: { $last: '$events' },
        },
      },
      {
        $match: {
          'latestEvent.timestamp': {
            $lte: eventTimestamp,
          },
        },
      },
    ];
    return parent.collection().aggregate(aggregationPipeline);
  },
  extensions: parent.extensions.concat(['signatoryStatusStateRepoExtension']),
});

module.exports = { signatoryStatusStateRepoExtension };
