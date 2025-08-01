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

const {
  generateDocJwt,
  jwtVerify,
  jwkFromSecp256k1Key,
} = require('@verii/jwt');
const { extractVerificationKey } = require('@verii/did-doc');

const isMatchingPrivateKeyKid = async (doc, key, kid) => {
  const signedValue = await generateDocJwt({ field: 'value' }, key, {
    kid,
    issuer: doc.id,
  });

  const verificationKey = extractVerificationKey(doc, kid);

  try {
    await jwtVerify(signedValue, jwkFromSecp256k1Key(verificationKey, false));
    return true;
  } catch (ex) {
    return false;
  }
};
module.exports = {
  isMatchingPrivateKeyKid,
};
