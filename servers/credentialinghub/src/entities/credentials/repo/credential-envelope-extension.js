/*
 * Copyright 2026 Velocity Team
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
const {
  inferCredentialEnvelopeMetadata,
} = require('../domain/credential-envelope');

const credentialEnvelopeExtension = (parent) => ({
  find: async (...args) =>
    map(inferCredentialEnvelopeMetadata, await parent.find(...args)),
  findById: async (...args) =>
    inferCredentialEnvelopeMetadata(await parent.findById(...args)),
  findOne: async (...args) =>
    inferCredentialEnvelopeMetadata(await parent.findOne(...args)),
  update: async (...args) =>
    inferCredentialEnvelopeMetadata(await parent.update(...args)),
  updateUsingFilter: async (...args) =>
    map(
      inferCredentialEnvelopeMetadata,
      await parent.updateUsingFilter(...args),
    ),
  extensions: parent.extensions.concat(['credentialEnvelopeExtension']),
});

module.exports = { credentialEnvelopeExtension };
