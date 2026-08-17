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
 */

const {
  CredentialDataModelVersions,
  CredentialEnvelopeFormats,
} = require('@verii/jwt');

const Openid4vciCredentialProfile = Object.freeze({
  context: 'https://www.w3.org/ns/credentials/v2',
  credentialFormat: CredentialEnvelopeFormats.VC_JWT,
  dataModelVersion: CredentialDataModelVersions.V2_0,
  format: 'application/vc+jwt',
});

const assertOpenid4vciIssuedCredential = ({
  credentialFormat,
  dataModelVersion,
} = {}) => {
  if (
    dataModelVersion !== Openid4vciCredentialProfile.dataModelVersion ||
    credentialFormat !== Openid4vciCredentialProfile.credentialFormat
  ) {
    throw new Error('OpenID4VCI issuer returned an unsupported credential');
  }
};

const isOpenid4vciCredentialFormat = (format) =>
  format === undefined || format === Openid4vciCredentialProfile.format;

module.exports = {
  assertOpenid4vciIssuedCredential,
  isOpenid4vciCredentialFormat,
  Openid4vciCredentialProfile,
};
