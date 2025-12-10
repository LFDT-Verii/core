/*
 * Copyright 2025 Velocity Team
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
/** @import { CredentialTypeMetadata } from "../../types/types" */

/**
 * Calculates the algTypeName based on credentialTypeMetadata
 * Currently RS signatures use COSEKEY, otherwise HEX encoding
 * @param {CredentialTypeMetadata} credentialTypeMetadata the credential type metadata
 * @returns {string} the alg type name
 */
const calcAlgTypeName = (credentialTypeMetadata) =>
  credentialTypeMetadata?.defaultSignatureAlgorithm?.startsWith('RS')
    ? 'COSEKEY_AES_256'
    : 'HEX_AES_256';

module.exports = { calcAlgTypeName };
