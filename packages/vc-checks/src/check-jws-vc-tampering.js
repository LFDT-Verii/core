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
  decodeCredentialEnvelope,
  isCredentialVerificationAccepted,
  verifyCredentialEnvelope,
} = require('@verii/jwt');
const { CheckResults } = require('./check-results');

const checkJwsVcTampering = async (jwt, verificationKey, { log }) => {
  try {
    const verification = await verifyCredentialEnvelope(jwt, verificationKey);
    if (isCredentialVerificationAccepted(verification)) {
      return CheckResults.PASS;
    }
    logVerificationFailure(jwt, verificationKey, verification, log);
    return verificationKey == null
      ? CheckResults.DATA_INTEGRITY_ERROR
      : CheckResults.FAIL;
  } catch (error) {
    log.error(
      { credentialId: safeCredentialId(jwt), verificationKey },
      `jwt tamper check failed: ${error.message}`,
    );
    return verificationKey == null
      ? CheckResults.DATA_INTEGRITY_ERROR
      : CheckResults.FAIL;
  }
};

const logVerificationFailure = (jwt, verificationKey, verification, log) => {
  const errors = [
    verification.proof,
    verification.conformance,
    verification.policy,
  ].flatMap(({ errors: assessmentErrors }) => assessmentErrors);
  log.error(
    {
      credentialId: safeCredentialId(jwt),
      verificationErrors: errors,
      verificationKey,
    },
    'jwt tamper check failed',
  );
};

const safeCredentialId = (compact) => {
  try {
    return decodeCredentialEnvelope(compact).credential.id;
  } catch {
    return undefined;
  }
};

module.exports = { checkJwsVcTampering };
