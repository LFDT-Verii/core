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

const { map, isEmpty } = require('lodash/fp');

const cleanPiiExtension = (parent, context) => ({
  cleanPii: async (filter) => {
    let aggregation = [
      {
        $match: {
          ...filter,
          'issuer.id': context.tenant.did,
        },
      },
    ];

    if (filter?.disclosureId) {
      aggregation = [
        {
          $lookup: {
            from: 'exchanges',
            localField: 'exchangeId',
            foreignField: '_id',
            as: 'exchangeOutput',
          },
        },
        {
          $addFields: {
            exchange: { $arrayElemAt: ['$exchangeOutput', 0] },
          },
        },
        {
          $addFields: {
            disclosureId: '$exchange.disclosureId',
          },
        },
        {
          $project: {
            exchangeOutput: 0,
            exchange: 0,
          },
        },
        ...aggregation,
      ];
    }

    const offers = await parent.collection().aggregate(aggregation).toArray();
    if (isEmpty(offers)) {
      return 0;
    }
    const updateQueries = map(
      (offer) => ({
        updateOne: {
          filter: { _id: offer._id },
          update: {
            $set: {
              credentialSubject: {
                vendorUserId: offer.credentialSubject.vendorUserId,
              },
            },
          },
        },
      }),
      offers
    );
    await parent.collection().bulkWrite(updateQueries);
    return offers.length;
  },
  extensions: parent.extensions.concat(['cleanPiiExtension']),
});

module.exports = { cleanPiiExtension };
