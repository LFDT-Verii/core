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
const { modPow } = require('bigint-crypto-utils');
const { padCharsStart } = require('lodash/fp');
/**
 * Is an even coordinate
 * @param {Buffer} y hex coordinate
 * @return {boolean} true it is even
 */
const isEcYValueEven = (y) => {
  return y[y.length - 1] % 2 === 0;
};

const bigIntToHex = (bigint) => {
  const hex = bigint.toString(16);
  if (hex.length % 2 === 1) {
    return `0${hex}`;
  }

  return hex;
};

/**
 * Is an even coordinate
 * @param {string} crv the crv P-256 or secp256k1
 * @param {Buffer} x coordinate
 * @param {boolean} true if the Y coordinate is even
 * @return {Buffer} y coordinate
 */
const deriveEcYValue = (crv, x, yIsEven) => {
  const expectedMod = yIsEven ? 0n : 1n;
  const bigX = BigInt(`0x${x.toString('hex')}`);

  // y^2 = x^3 - ax + b
  let bigY = modPow(
    bigX ** 3n - bigX * curveParams[crv].a + curveParams[crv].b,
    curveParams[crv].pIdent,
    curveParams[crv].prime
  );

  // If the parity doesn't match it's the *other* root
  if (bigY % 2n !== expectedMod) {
    bigY = curveParams[crv].prime - bigY;
  }

  const hexY = padCharsStart('0', 64, bigIntToHex(bigY));

  return Buffer.from(hexY, 'hex');
};

const curveParams = {
  'P-256': {
    prime: 2n ** 256n - 2n ** 224n + 2n ** 192n + 2n ** 96n - 1n,
    a: 3n,
    b: 41058363725152142129326129780047268409114441015993725554835256314039467401291n,
  },
  secp256k1: {
    prime:
      2n ** 256n -
      2n ** 32n -
      2n ** 9n -
      2n ** 8n -
      2n ** 7n -
      2n ** 6n -
      2n ** 4n -
      1n,
    a: 0n,
    b: 7n,
  },
};

const calcPIdent = ({ prime }) => (prime + 1n) / 4n;
curveParams['P-256'].pIdent = calcPIdent(curveParams['P-256']);
curveParams.secp256k1.pIdent = calcPIdent(curveParams.secp256k1);

module.exports = {
  isEcYValueEven,
  deriveEcYValue,
};
