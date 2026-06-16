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
const { toDidUrl } = require('@verii/did-doc');
const { toEthereumAddress } = require('@verii/blockchain-functions');
const { KeyPurposes } = require('@verii/crypto');

const buildVeriiIssuer = (tenant, issuerService) => {
  const veriiIssuer = {
    id: tenant._id,
    did: tenant.did,
    issuingServiceKMSKeyId:
      tenant.keysByPurpose[KeyPurposes.ISSUING_METADATA]._id,
    issuingServiceDIDKeyId: toDidUrl(
      tenant.did,
      tenant.keysByPurpose[KeyPurposes.ISSUING_METADATA].kidFragment,
    ),
    dltOperatorAddress: toEthereumAddress(
      tenant.keysByPurpose[KeyPurposes.DLT_TRANSACTIONS].publicJwk,
    ),
    dltOperatorKMSKeyId: tenant.keysByPurpose[KeyPurposes.DLT_TRANSACTIONS]._id,
    dltPrimaryAddress: tenant.primaryAccount,
  };
  if (issuerService != null) {
    veriiIssuer.issuingRefreshServiceId =
      issuerService.velocityNetworkServiceId;
  }
  return veriiIssuer;
};

module.exports = { buildVeriiIssuer };
