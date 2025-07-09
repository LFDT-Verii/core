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

const { VnfProtocolVersions } = require('./vnf-protocol-versions');
const { CheckResults } = require('./check-results');

const checkHolder = (credential, expectedHolderDid, { log }) => {
  const {
    vnfProtocolVersion = VnfProtocolVersions.VNF_PROTOCOL_VERSION_1,
    credentialSubject,
  } = credential;
  if (vnfProtocolVersion < VnfProtocolVersions.VNF_PROTOCOL_VERSION_2) {
    return CheckResults.NOT_APPLICABLE;
  }

  if (
    expectedHolderDid == null ||
    credentialSubject?.id !== expectedHolderDid
  ) {
    log.error(
      { credentialSubjectId: credentialSubject?.id, expectedHolderDid },
      'holder check failed'
    );
    return CheckResults.FAIL;
  }
  return CheckResults.PASS;
};

module.exports = { checkHolder };
