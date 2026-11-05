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
 *
 */
const { signVeriiCredentialsFacade } = require('../../credentials');
const { resolveCredentialSigningAlgorithm } = require('../../tenants');

// Signs a credential for the holder, for the credential and deferred credential endpoints.
const signCredential = async (
  credential,
  credentialSubjectId,
  service,
  context,
) =>
  signVeriiCredentialsFacade(
    [credential.content],
    credentialSubjectId,
    [credential.typeMetadata],
    [
      resolveCredentialSigningAlgorithm({
        credentialTypeMetadata: credential.typeMetadata,
        tenant: context.tenant,
      }),
    ],
    service,
    context,
  );

module.exports = { signCredential };
