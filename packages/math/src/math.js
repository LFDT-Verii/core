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

const BigNumber = require('bignumber.js');
const { size, padCharsEnd } = require('lodash/fp');

const toBigNumber = (value) => new BigNumber(value);
const fromBigNumber = (value, fixedPoint) => {
  if (!BigNumber.isBigNumber(value)) {
    throw new Error(`${value} is not BigNumber`);
  }
  return fixedPoint ? value.toFixed(fixedPoint) : value.toFixed();
};
const addBigNumbers = (a, b) => a.plus(b);
const subtractBigNumbers = (a, b) => a.minus(b);
const multiplyBigNumbers = (a, b) => a.multipliedBy(b);
const divideBigNumbers = (a, b) => a.dividedBy(b);
const isGreaterThan = (a, b) => a.isGreaterThan(b);
const isGreaterThanOrEqualTo = (a, b) => a.isGreaterThanOrEqualTo(b);
const ceilBigNumber = (a) => toBigNumber(a.integerValue(BigNumber.ROUND_CEIL));
const floorBigNumber = (a) =>
  toBigNumber(a.integerValue(BigNumber.ROUND_FLOOR));
const formatToDecimalString = (a) => {
  const splitted = a.toFixed(3, 1).split('.');
  let decimals = '00';

  if (splitted[1] && size(splitted[1]) === 3) {
    decimals =
      Number(splitted[1][2]) === 0 ? splitted[1].slice(0, 2) : splitted[1];
  }

  if (splitted[1] && size(splitted[1]) <= 2) {
    decimals = padCharsEnd('0', 2, splitted[1].slice(0, 2));
  }

  return `${splitted[0]}.${decimals}`;
};
const absBigNumber = (a) => a.abs();
const maximumBigNumber = (...args) => BigNumber.max.apply(null, args);

module.exports = {
  toBigNumber,
  fromBigNumber,
  addBigNumbers,
  subtractBigNumbers,
  multiplyBigNumbers,
  divideBigNumbers,
  isGreaterThan,
  isGreaterThanOrEqualTo,
  ceilBigNumber,
  floorBigNumber,
  formatToDecimalString,
  absBigNumber,
  maximumBigNumber,
};
