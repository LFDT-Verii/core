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

const { map } = require('lodash/fp');
const { nanoid } = require('nanoid');

const registrarConsentRepoExtension = (parent) => ({
  registerConsent: (
    { userId, organizationId, type, version, ...rest },
    ...args
  ) => {
    return parent.insert(
      {
        consentId: nanoid(),
        userId,
        organizationId,
        version,
        type,
        ...rest,
      },
      ...args
    );
  },
  registerConsents: (consents, ...args) => {
    const consentsForInsert = map((consent) => {
      const { userId, organizationId, type, version, ...rest } = consent;
      return {
        consentId: nanoid(),
        userId,
        organizationId,
        version,
        type,
        createdAt: new Date(),
        ...rest,
      };
    }, consents);
    return parent.insertMany(consentsForInsert, ...args);
  },
  extensions: parent.extensions.concat(['registrarConsentRepoExtension']),
});

module.exports = { registrarConsentRepoExtension };
