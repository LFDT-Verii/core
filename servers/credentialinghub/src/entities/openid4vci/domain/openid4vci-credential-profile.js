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
const {
  toCredentialConfigurationId,
} = require('./to-credential-configuration-id');

const Openid4vciCredentialProfiles = Object.freeze({
  [CredentialEnvelopeFormats.JWT_VC_JSON_LD]: Object.freeze({
    context: 'https://www.w3.org/2018/credentials/v1',
    credentialFormat: CredentialEnvelopeFormats.JWT_VC_JSON_LD,
    dataModelVersion: CredentialDataModelVersions.V1_1,
    format: CredentialEnvelopeFormats.JWT_VC_JSON_LD,
  }),
  [CredentialEnvelopeFormats.VC_JWT]: Object.freeze({
    context: 'https://www.w3.org/ns/credentials/v2',
    credentialFormat: CredentialEnvelopeFormats.VC_JWT,
    dataModelVersion: CredentialDataModelVersions.V2_0,
    format: 'application/vc+jwt',
  }),
});

const assertOpenid4vciIssuedCredential = (issuedCredential, profile) => {
  const { credentialFormat, dataModelVersion } = issuedCredential ?? {};
  if (
    profile == null ||
    dataModelVersion !== profile.dataModelVersion ||
    credentialFormat !== profile.credentialFormat
  ) {
    throw new Error('OpenID4VCI issuer returned an unsupported credential');
  }
};

const getOpenid4vciCredentialProfileByConfigurationId = (
  credentialConfigurationId,
  credentialType,
) =>
  Object.values(Openid4vciCredentialProfiles).find(
    ({ credentialFormat }) =>
      credentialConfigurationId ===
      toCredentialConfigurationId(credentialType, credentialFormat),
  );

const getOpenid4vciCredentialProfileByFormat = (format) =>
  Object.values(Openid4vciCredentialProfiles).find(
    (profile) => profile.format === format,
  );

const isOpenid4vciCredentialFormat = (format) =>
  format === undefined ||
  getOpenid4vciCredentialProfileByFormat(format) != null;

module.exports = {
  assertOpenid4vciIssuedCredential,
  getOpenid4vciCredentialProfileByConfigurationId,
  getOpenid4vciCredentialProfileByFormat,
  isOpenid4vciCredentialFormat,
  Openid4vciCredentialProfiles,
};
