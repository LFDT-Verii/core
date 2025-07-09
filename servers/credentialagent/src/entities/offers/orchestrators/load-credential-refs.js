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
 *
 */

const { keyBy, flow, flatMapDeep, compact, map, uniq } = require('lodash/fp');

const loadCredentialRefs = async (offers, context) => {
  const { repos } = context;

  const identifiers = flow(
    flatMapDeep(({ relatedResource, replaces, linkedCredentials } = {}) => [
      relatedResource,
      replaces,
      map(
        ({ linkedCredentialId }) => ({ id: linkedCredentialId }),
        linkedCredentials
      ),
    ]),
    map('id'),
    compact,
    uniq
  )(offers);

  const dbOffers = await repos.offers.find(
    {
      filter: {
        did: { $in: identifiers },
      },
    },
    {
      did: 1,
      type: 1,
      offerId: 1,
      digestSRI: 1,
      linkCode: 1,
      credentialStatus: 1,
    }
  );
  return keyBy('did', dbOffers);
};

module.exports = {
  loadCredentialRefs,
};
