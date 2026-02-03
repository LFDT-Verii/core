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

const { extractVerificationMethod } = require('@verii/did-doc');
const newError = require('http-errors');
const { isEmpty } = require('lodash/fp');

const extractVerificationMethodFromByoDID = ({ didDocument, kidFragment }) => {
  const verificationMethod = extractVerificationMethod(
    didDocument,
    kidFragment,
  );
  if (isEmpty(verificationMethod)) {
    throw newError(400, 'Key not found in BYO DID', {
      code: 'key_not_found_in_byo_did_doc',
    });
  }

  return verificationMethod;
};

module.exports = {
  extractVerificationMethodFromByoDID,
};
