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

const newError = require('http-errors');
const { TenantErrors } = require('./tenant-errors');

const CredentialSigningAlgorithms = Object.freeze(['ES256K', 'ES256', 'RS256']);
const DEFAULT_CREDENTIAL_SIGNING_ALGORITHM = 'ES256K';

const resolveCredentialSigningAlgorithm = ({
  tenant = {},
  credentialTypeMetadata = {},
} = {}) => {
  if (tenant.credentialSigningAlgorithm != null) {
    return assertCredentialSigningAlgorithm(tenant.credentialSigningAlgorithm);
  }

  const credentialTypeAlgorithm = normalizeCredentialTypeAlgorithm(
    credentialTypeMetadata.defaultSignatureAlgorithm,
  );
  return assertCredentialSigningAlgorithm(
    credentialTypeAlgorithm ?? DEFAULT_CREDENTIAL_SIGNING_ALGORITHM,
  );
};

const assertCredentialSigningAlgorithm = (algorithm) => {
  if (!CredentialSigningAlgorithms.includes(algorithm)) {
    throw newError(
      400,
      TenantErrors.CREDENTIAL_SIGNING_ALGORITHM_NOT_SUPPORTED,
      {
        errorCode: TenantErrors.CREDENTIAL_SIGNING_ALGORITHM_NOT_SUPPORTED,
      },
    );
  }
  return algorithm;
};

const normalizeCredentialTypeAlgorithm = (algorithm) =>
  algorithm === 'SECP256K1' ? 'ES256K' : algorithm;

module.exports = {
  CredentialSigningAlgorithms,
  DEFAULT_CREDENTIAL_SIGNING_ALGORITHM,
  resolveCredentialSigningAlgorithm,
};
