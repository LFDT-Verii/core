/*
 * Copyright 2025 Velocity Team
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

const newError = require('http-errors');
const { ExchangeStates } = require('../../exchanges');

// TODO refactor as exchange extension
const deduplicateDisclosureExchange = async (
  presentation,
  { repos, exchange }
) => {
  const dbUpdateResult = await repos.exchanges.collection().updateOne(
    {
      _id: exchange._id,
      presentationId: { $ne: presentation.id },
    },
    {
      $set: {
        presentationId: presentation.id,
        disclosureConsentedAt: new Date(),
      },
      $push: {
        events: {
          state: ExchangeStates.DISCLOSURE_RECEIVED,
          timestamp: new Date(),
        },
      },
    }
  );

  if (dbUpdateResult.modifiedCount === 0) {
    throw newError(409, 'Presentation has already been submitted', {
      errorCode: 'presentation_duplicate',
    });
  }
};

module.exports = { deduplicateDisclosureExchange };
