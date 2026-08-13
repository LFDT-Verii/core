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

const { KeyAlgorithms } = require('@verii/crypto');
const { CredentialSigningAlgorithms } = require('@verii/verii-issuing');

const getCredentialSigningAlgorithmsSupported = ({
  tenant = {},
  credentialTypeMetadata = {},
} = {}) => {
  const effectiveAlgorithm = resolveCredentialSigningAlgorithm({
    tenant,
    credentialTypeMetadata,
  });
  if (tenant.credentialSigningAlgorithm != null) {
    return [effectiveAlgorithm];
  }
  return [
    effectiveAlgorithm,
    ...CredentialSigningAlgorithms.filter(
      (algorithm) => algorithm !== effectiveAlgorithm,
    ),
  ];
};

const resolveCredentialSigningAlgorithm = ({
  tenant = {},
  credentialTypeMetadata = {},
} = {}) =>
  tenant.credentialSigningAlgorithm ??
  credentialTypeMetadata.defaultSignatureAlgorithm ??
  KeyAlgorithms.SECP256K1;

module.exports = {
  CredentialSigningAlgorithms,
  getCredentialSigningAlgorithmsSupported,
  resolveCredentialSigningAlgorithm,
};
