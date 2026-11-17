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

const RESOLUTION_METADATA_ERROR = {
  UNRESOLVED_MULTI_DID_ENTRIES: 'UNRESOLVED_MULTI_DID_ENTRIES',
  DATA_INTEGRITY_ERROR: 'DATA_INTEGRITY_ERROR',
};

const VERSION = '1';

const ALG_TYPE = {
  HEX_AES_256: 'aes-256-gcm',
  COSEKEY_AES_256: 'cosekey:aes-256-gcm',
};

// Error codes set on errors the registries throw before any contract call.
const RevocationRegistryErrorCodes = Object.freeze({
  INVALID_REVOCATION_URL: 'invalid_revocation_url',
});

module.exports = {
  RESOLUTION_METADATA_ERROR,
  RevocationRegistryErrorCodes,
  VERSION,
  ALG_TYPE,
};
