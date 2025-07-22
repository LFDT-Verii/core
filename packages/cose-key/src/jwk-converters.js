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

const {
  RSAKeyParameters,
  EC2KeyParameters,
  EllipticCurves,
  KeyTypes,
  KeyParameters,
} = require('./cose-iana');

const { CoseKey } = require('./cose-key');

const { deriveEcYValue, isEcYValueEven } = require('./derive-ec-y-values');

const toJwk = (coseKey) => {
  const kty = coseKey.getParam(KeyParameters.Kty);
  if (kty === KeyTypes.RSA) {
    return {
      kty: 'RSA',
      n: Buffer.from(coseKey.getParam(RSAKeyParameters.N)).toString(
        'base64url'
      ),
      e: Buffer.from(coseKey.getParam(RSAKeyParameters.E)).toString(
        'base64url'
      ),
    };
  }
  if (kty === KeyTypes.EC2) {
    const crv =
      coseKey.getParam(EC2KeyParameters.Crv) === EllipticCurves.Secp256k1
        ? 'secp256k1'
        : 'P-256';
    const x = Buffer.from(coseKey.getParam(EC2KeyParameters.X));
    const y = deriveEcYValue(crv, x, coseKey.getParam(EC2KeyParameters.Y));

    return {
      kty: 'EC',
      crv,
      x: x.toString('base64url'),
      y: y.toString('base64url'),
    };
  }

  throw new Error('Unsupported COSE Key Type (kty)');
};

const fromJwk = (jwk) => {
  const key = new CoseKey();
  if (jwk.kty === 'RSA') {
    key.kty = KeyTypes.RSA;
    return key
      .setParam(RSAKeyParameters.N, Buffer.from(jwk.n, 'base64url'))
      .setParam(RSAKeyParameters.E, Buffer.from(jwk.e, 'base64url'));
  }
  if (jwk.kty === 'EC') {
    const y = isEcYValueEven(Buffer.from(jwk.y, 'base64url'));
    key.kty = KeyTypes.EC2;
    return key
      .setParam(
        EC2KeyParameters.Crv,
        jwk.crv === 'secp256k1'
          ? EllipticCurves.Secp256k1
          : EllipticCurves.P_256
      )
      .setParam(EC2KeyParameters.X, Buffer.from(jwk.x, 'base64url'))
      .setParam(EC2KeyParameters.Y, y);
  }
  throw new Error('Unsupported JWK Key Type (kty)');
};

module.exports = {
  toJwk,
  fromJwk,
};
