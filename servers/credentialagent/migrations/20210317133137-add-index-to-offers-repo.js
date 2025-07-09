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

module.exports = {
  up: async (db) => {
    await db.collection('offers').createIndexes(
      [
        {
          key: { exchangeId: 1 },
          name: 'exchangeIdIndex',
        },
        {
          key: { did: 1 },
          name: 'didIndex',
        },
        {
          key: { 'issuer.id': 1 },
          name: 'issuerIndex',
        },
        {
          key: { 'credentialSubject.vendorUserId': 1 },
          name: 'credentialSubjectIndex',
        },
        {
          key: { offerId: 1 },
          name: 'offerIdIndex',
        },
      ],
      {
        sparse: true,
      }
    );
  },

  down: async (db) => {
    db.collection('offers').dropIndexes({
      exchangeIdIndex: 1,
      issuerIndex: 1,
      offerIdIndex: 1,
      didIndex: 1,
      credentialSubjectIndex: 1,
    });
  },
};
