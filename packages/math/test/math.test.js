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

const {
  toBigNumber,
  fromBigNumber,
  addBigNumbers,
  subtractBigNumbers,
  multiplyBigNumbers,
  divideBigNumbers,
  isGreaterThan,
  isGreaterThanOrEqualTo,
  ceilBigNumber,
  formatToDecimalString,
  floorBigNumber,
  maximumBigNumber,
} = require('../src/math');
const { absBigNumber } = require('../src');

describe('math test suite', () => {
  describe('toBigNumber test suite', () => {
    // eslint-disable-next-line max-len
    it('should return Bignumber if String value is passed', () => {
      const bigNumberX = toBigNumber('000999.550000000');
      expect(bigNumberX instanceof BigNumber).toEqual(true);
      expect(`${bigNumberX}`).toEqual('999.55');
    });
  });
  describe('fromBigNumber test suite', () => {
    it('should error with a non BigNumber', () => {
      const func = () => fromBigNumber(123);
      expect(func).toThrowError('123 is not BigNumber');
    });
    it('should return String if BigNumber is passed', () => {
      const stringX = fromBigNumber(toBigNumber('000999.550000000'));
      expect(stringX).toEqual('999.55');
    });

    it('should return String if BigNumber is passed with fixedPoint', () => {
      const string1 = fromBigNumber(toBigNumber('1.156'), 2);
      const string2 = fromBigNumber(toBigNumber('1.156'), 1);
      expect(string1).toEqual('1.16');
      expect(string2).toEqual('1.2');
    });
  });
  describe('arithmetic test suite', () => {
    describe('addition test suite', () => {
      it('should add big numbers', () => {
        const n1 = '17.26';
        const n2 = '1.97';
        const result = addBigNumbers(toBigNumber(n1), toBigNumber(n2));
        expect(result instanceof BigNumber).toEqual(true);
        expect(`${result}`).toEqual('19.23');
      });
    });
    describe('subtraction test suite', () => {
      it('should subtract small numbers with same precision as precision', () => {
        const n1 = '17.26';
        const n2 = '1.97';
        const result = subtractBigNumbers(toBigNumber(n1), toBigNumber(n2));
        expect(result instanceof BigNumber).toEqual(true);
        expect(`${result}`).toEqual('15.29');
      });
    });
    describe('multiplication test suite', () => {
      it('should multiply small numbers with same precision as precision', () => {
        const n1 = '17.26';
        const n2 = '1.97';
        const result = multiplyBigNumbers(toBigNumber(n1), toBigNumber(n2));
        expect(result instanceof BigNumber).toEqual(true);
        expect(`${result}`).toEqual('34.0022');
      });
    });
    describe('division test suite', () => {
      it('should divide small numbers with same precision as precision', () => {
        const n1 = '17.26';
        const n2 = '1.97';
        const result = divideBigNumbers(toBigNumber(n1), toBigNumber(n2));
        expect(result instanceof BigNumber).toEqual(true);
        expect(`${result}`).toEqual('8.76142131979695431472');
      });
    });
  });

  describe('isGreaterThan test suite', () => {
    it('should isGreaterThan work correctly', () => {
      const n1 = '17.26';
      const n2 = '1.97';
      const result1 = isGreaterThan(toBigNumber(n1), toBigNumber(n2));
      const result2 = isGreaterThan(toBigNumber(n2), toBigNumber(n1));
      expect(result1).toEqual(true);
      expect(result2).toEqual(false);
    });

    it('should return false if values the same', () => {
      const n1 = '17.12';
      const result = isGreaterThan(toBigNumber(n1), toBigNumber(n1));
      expect(result).toEqual(false);
    });
  });

  describe('isGreaterThanOrEqualTo test suite', () => {
    it('should isGreaterThanOrEqualTo work correctly', () => {
      const n1 = '17.26';
      const n2 = '1.97';
      const result1 = isGreaterThanOrEqualTo(toBigNumber(n1), toBigNumber(n2));
      const result2 = isGreaterThanOrEqualTo(toBigNumber(n2), toBigNumber(n1));
      expect(result1).toEqual(true);
      expect(result2).toEqual(false);
    });

    it('should return true if values the same', () => {
      const n1 = '17.12';
      const result = isGreaterThanOrEqualTo(toBigNumber(n1), toBigNumber(n1));
      expect(result).toEqual(true);
    });
  });

  describe('ceilBigNumber test suite', () => {
    it('should ceilBigNumber work correctly', () => {
      const n1 = '17.00';
      const n2 = '17.4678';
      const result1 = ceilBigNumber(toBigNumber(n1));
      const result2 = ceilBigNumber(toBigNumber(n2));
      expect(result1 instanceof BigNumber).toEqual(true);
      expect(result2 instanceof BigNumber).toEqual(true);
      expect(`${result1}`).toEqual('17');
      expect(`${result2}`).toEqual('18');
    });
  });

  describe('floorBigNumber test suite', () => {
    it('should floorBigNumber work correctly', () => {
      const n1 = '17.00';
      const n2 = '17.678';
      const result1 = floorBigNumber(toBigNumber(n1));
      const result2 = floorBigNumber(toBigNumber(n2));
      expect(result1 instanceof BigNumber).toEqual(true);
      expect(result2 instanceof BigNumber).toEqual(true);
      expect(`${result1}`).toEqual('17');
      expect(`${result2}`).toEqual('17');
    });
  });

  describe('formatToDecimalString test suite', () => {
    it('should formatToDecimalString work correctly', () => {
      const result1 = formatToDecimalString(toBigNumber(1));
      const result2 = formatToDecimalString(toBigNumber(1.09));
      const result3 = formatToDecimalString(toBigNumber(1.1));
      const result4 = formatToDecimalString(toBigNumber(1.11));
      const result5 = formatToDecimalString(toBigNumber(1.111));
      const result6 = formatToDecimalString(toBigNumber(1.1116));

      expect(result1).toBe('1.00');
      expect(result2).toBe('1.09');
      expect(result3).toBe('1.10');
      expect(result4).toBe('1.11');
      expect(result5).toBe('1.111');
      expect(result6).toBe('1.111');
    });
  });

  describe('abs test suite', () => {
    it('should absBigNumber work correctly', () => {
      const result = absBigNumber(toBigNumber(-1));
      expect(result instanceof BigNumber).toEqual(true);
      expect(`${result}`).toEqual('1');
    });
  });

  describe('maximum test suite', () => {
    it('should maximumBigNumber work correctly', () => {
      const result = maximumBigNumber(
        toBigNumber(-1),
        toBigNumber(1),
        toBigNumber(3)
      );
      expect(result instanceof BigNumber).toEqual(true);
      expect(`${result}`).toEqual('3');
    });
  });
});
