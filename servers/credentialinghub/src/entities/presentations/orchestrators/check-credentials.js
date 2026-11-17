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
const { verifyCredentials } = require('@verii/verii-verification');
const { KeyPurposes } = require('@verii/crypto');
const {
  resolveDid,
  getOrganizationVerifiedProfile,
  getCredentialTypeMetadata,
} = require('@verii/common-fetchers');

const checkCredentials = (jwtVcs, expectedHolderDid, context) => {
  const { tenant } = context;

  // eslint-disable-next-line better-mutation/no-mutation
  context.caoDid = tenant.caoDid;

  return verifyCredentials(
    {
      credentials: jwtVcs,
      expectedHolderDid,
      relyingParty: {
        dltOperatorKMSKeyId:
          tenant.keysByPurpose[KeyPurposes.DLT_TRANSACTIONS]._id,
      },
    },
    {
      resolveDid,
      getOrganizationVerifiedProfile,
      getCredentialTypeMetadata,
    },
    context,
  );
};

module.exports = {
  checkCredentials,
};
