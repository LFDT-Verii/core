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

const VerifiableCredentialTypes = {
  BASIC_PROFILE_V1_0: 'OrganizationBasicProfile-v1.0',
  VERIFIABLE_CREDENTIAL: 'VerifiableCredential',
};

const VerifiableCredentialFormats = {
  JWT_VC: 'jwt_vc',
};

const CredentialCheckResultValue = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  NOT_CHECKED: 'NOT_CHECKED',
  SELF_SIGNED: 'SELF_SIGNED',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
};

module.exports = {
  VerifiableCredentialTypes,
  VerifiableCredentialFormats,
  CredentialCheckResultValue,
};
