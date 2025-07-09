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

const issuedCredentialProjection = {
  _id: 1,
  '@context': 1,
  did: 1,
  exchangeId: 1,
  issuer: 1,
  issued: 1,
  name: 1,
  type: 1,
  offerId: 1,
  credentialSubject: 1,
  credentialSchema: 1,
  credentialStatus: 1,
  contentHash: 1,
  linkCode: 1,
  replaces: 1,
  relatedResource: 1,
  linkCodeCommitment: 1,
  linkedCredentials: 1,
  validFrom: 1,
  validUntil: 1,
  issuanceDate: 1,
  consentedAt: 1,
  createdAt: 1,
  updatedAt: 1,
};

module.exports = { issuedCredentialProjection };
