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

const { deriveJwk, jwtDecode, jwtVerify } = require('./core');
const { buildDecodedPresentation } = require('./credential-envelope-legacy');
const { decodeCredentialEnvelope } = require('./credential-envelope-codec');
const {
  assertCredentialVerificationAccepted,
  verifyCredentialEnvelope,
} = require('./credential-envelope-verifier');

const decodeCredentialJwt = (credentialJwt) =>
  decodeCredentialEnvelope(credentialJwt).credential;

const decodePresentationJwt = (presentationJwt) => {
  const { payload } = jwtDecode(presentationJwt);
  return buildDecodedPresentation(payload);
};

const verifyCredentialJwt = async (credentialJwt, key) => {
  const normalizedKey = key == null ? undefined : deriveJwk(credentialJwt, key);
  const verified = assertCredentialVerificationAccepted(
    await verifyCredentialEnvelope(credentialJwt, normalizedKey, {
      mode: 'legacy-jwt',
    }),
  );
  return verified.credential;
};

const verifyPresentationJwt = async (presentationJwt, key) => {
  const jwk = deriveJwk(presentationJwt, key);
  const { payload } = await jwtVerify(presentationJwt, jwk);
  return buildDecodedPresentation(payload);
};

module.exports = {
  decodeCredentialJwt,
  decodePresentationJwt,
  verifyCredentialJwt,
  verifyPresentationJwt,
};
