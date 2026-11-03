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
 *
 */

// A credential can be claimed until it is signed (`did`), accepted or
// rejected. Signing it again would give the holder a second copy, with its
// own credential status, that revoking the record doesn't reach.
// repo/claimable-credential-filter.js has the same rule as a Mongo filter.
const isClaimableCredential = (credential) =>
  credential.did == null &&
  credential.acceptedAt == null &&
  credential.rejectedAt == null;

module.exports = { isClaimableCredential };
