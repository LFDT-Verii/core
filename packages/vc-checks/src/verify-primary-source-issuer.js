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

const { flow, get, map, compact } = require('lodash/fp');

const verifyPrimarySourceIssuer = (
  { credential, issuerId, credentialTypeMetadata },
  { log },
) => {
  if (credentialTypeMetadata.primaryOrganizationClaimPaths == null) {
    log.info(
      `${credential.type} metadata does not contain "primaryOrganizationClaimPaths"`,
    );
    return true;
  }

  const credentialClaims = flow(
    map((claimPath) => getCredentialClaim(credential, claimPath)),
    compact,
  )(credentialTypeMetadata.primaryOrganizationClaimPaths);

  if (credentialClaims.length > 0 && !credentialClaims.includes(issuerId)) {
    throw new Error('issuer_requires_notary_permission');
  }
  return true;
};

const getCredentialClaim = (credential, claimPath) =>
  get(claimPath?.join('.'), credential);

module.exports = {
  verifyPrimarySourceIssuer,
};
