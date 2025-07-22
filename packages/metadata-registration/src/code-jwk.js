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

const { hexFromJwk, jwkFromSecp256k1Key } = require('@verii/jwt');
const {
  get2BytesHash,
  encrypt,
  encryptBuffer,
  decrypt,
  decryptBuffer,
} = require('@verii/crypto');
const { CoseKey, fromJwk, toJwk } = require('@verii/cose-key');
const { ALG_TYPE } = require('./constants');

const encodeJwk = async (algType, jwk, secret) => {
  if (algType === ALG_TYPE.HEX_AES_256) {
    if (jwk.kty !== 'EC' || jwk.crv !== 'secp256k1') {
      throw new Error('Hex encoding is only supported for secp256k1 keys');
    }
    return Buffer.from(encrypt(hexFromJwk(jwk, false), secret), 'base64');
  }

  if (algType === ALG_TYPE.COSEKEY_AES_256) {
    const coseKey = fromJwk(jwk);
    return encryptBuffer(Buffer.from(await coseKey.toBytes()), secret);
  }

  throw new Error(`Unsupported Credential Metadata Algorithm Type ${algType}`);
};

const decodeJwk = async (algType, rawKeyBuffer, secret) => {
  if (algType === get2BytesHash(ALG_TYPE.HEX_AES_256)) {
    return jwkFromSecp256k1Key(
      decrypt(rawKeyBuffer.toString('base64'), secret),
      false
    );
  }
  if (algType === get2BytesHash(ALG_TYPE.COSEKEY_AES_256)) {
    const coseKey = await CoseKey.fromBytes(
      decryptBuffer(rawKeyBuffer, secret)
    );
    return toJwk(coseKey);
  }
  throw new Error(`Unsupported Credential Metadata Algorithm Type ${algType}`);
};

module.exports = {
  encodeJwk,
  decodeJwk,
};
