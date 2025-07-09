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

const exchangeRepoDefaultProjection = {
  _id: 1,
  type: 1,
  disclosureId: 1,
  protocolMetadata: 1,
  pushDelegate: 1,
  pushSentAt: 1,
  disclosureConsentedAt: 1,
  disclosureRejectedAt: 1,
  requestedTypesFeedback: 1,
  identityMatcherValues: 1,
  vendorUserId: 1,
  events: 1,
  createdAt: 1,
  updatedAt: 1,
  presentationId: 1,
  offerHashes: 1,
  offerIds: 1,
  vendorOfferStatuses: 1,
  finalizedOfferIds: 1,
  credentialTypes: 1,
  challenge: 1,
  challengeIssuedAt: 1,
  err: 1,
};

module.exports = {
  exchangeRepoDefaultProjection,
};
