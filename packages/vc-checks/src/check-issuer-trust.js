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

const {
  verifyIssuerForCredentialType,
} = require('./verify-issuer-for-credential-type');
const { CheckResults } = require('./check-results');
const { verifyBoundIssuerVc } = require('./verify-bound-issuer-vc');

const checkIssuerTrust = async (
  credential,
  issuerId,
  dependencies,
  context
) => {
  const { log } = context;

  try {
    const ok = await verifyBoundIssuerVc(dependencies, context);
    if (!ok) {
      return CheckResults.FAIL;
    }
  } catch {
    return CheckResults.DATA_INTEGRITY_ERROR;
  }

  try {
    verifyIssuerForCredentialType(credential, issuerId, dependencies, context);
    return CheckResults.PASS;
  } catch (err) {
    log.error(
      { err, credential, dependencies },
      'Check issuer credentials: the issuer chain failed for the issuer VC'
    );
    if (err.message === 'unresolved_credential_subject_context') {
      return CheckResults.DEPENDENCY_RESOLUTION_ERROR;
    }

    return CheckResults.FAIL;
  }
};

module.exports = { checkIssuerTrust };
