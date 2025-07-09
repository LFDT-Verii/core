/*
 * Copyright 2024 Velocity Team
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
const { verifyCredentialJwt, safeJwtDecode } = require('@verii/jwt');
const { extractVerificationKey, isDidMatching } = require('@verii/did-doc');

const verifyBoundIssuerVc = async (
  { issuerDidDocument, boundIssuerVc },
  { log }
) => {
  const decodedBoundIssuerVc = safeJwtDecode(boundIssuerVc);
  const kid = decodedBoundIssuerVc?.header?.kid;
  if (kid == null) {
    throw new Error(
      'verifyBoundIssuerVc: the boundIssuerVc is incorrectly formatted'
    );
  }

  try {
    const verificationKey = extractVerificationKey(issuerDidDocument, kid);
    await verifyCredentialJwt(boundIssuerVc, verificationKey);
  } catch (error) {
    log.error(
      { decodedBoundIssuerVc },
      'checkIssuerTrust: the boundIssuerVc does not verify'
    );
    return false;
  }

  if (!isDidMatching(decodedBoundIssuerVc?.payload?.iss, issuerDidDocument)) {
    log.error(
      { issuerDidDocument, decodedBoundIssuerVc },
      "checkIssuerTrust: the boundIssuerVc is not for the credential's issuer"
    );
    return false;
  }

  return true;
};

module.exports = { verifyBoundIssuerVc };
