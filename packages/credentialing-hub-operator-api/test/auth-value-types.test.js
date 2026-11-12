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

const { describe, it } = require('node:test');
const { expect } = require('expect');
const { isOfValueType, isValidAuthValue } = require('../src/auth-value-types');

const expectValid = (rule, values) => {
  for (const value of values) {
    expect({ value, valid: isValidAuthValue(rule, value) }).toEqual({
      value,
      valid: true,
    });
  }
};

const expectInvalid = (rule, values) => {
  for (const value of values) {
    expect({ value, valid: isValidAuthValue(rule, value) }).toEqual({
      value,
      valid: false,
    });
  }
};

describe('auth value types', () => {
  describe('isValidAuthValue', () => {
    it('should accept a non-blank string for a string rule, and nothing else', () => {
      const rule = { valueType: 'string' };
      expectValid(rule, ['EMP-1', ' 12345 ', 'true']);
      expectInvalid(rule, ['', '  \t', 12345, 0, true, false, null, {}, []]);
    });

    it('should accept a finite number for a number rule, and nothing else', () => {
      const rule = { valueType: 'number' };
      expectValid(rule, [12345, 0, -1.5]);
      expectInvalid(rule, [
        '12345',
        '',
        true,
        null,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        [1],
      ]);
    });

    it('should accept a boolean for a boolean rule, and nothing else', () => {
      const rule = { valueType: 'boolean' };
      expectValid(rule, [true, false]);
      expectInvalid(rule, ['true', 'false', 1, 0, null]);
    });

    it('should accept an email address for an email rule, after trimming it', () => {
      const rule = { valueType: 'string', valueFormat: 'email' };
      expectValid(rule, [
        'adam@example.com',
        ' Adam.Smith@Example.COM\t',
        "o'brien+tag@mail.example.co.uk",
      ]);
      expectInvalid(rule, [
        'adam',
        'adam@',
        '@example.com',
        'adam@example',
        'adam smith@example.com',
        'adam@@example.com',
        '',
        12345,
      ]);
    });

    it('should accept an E.164 phone number for an e164 rule, after trimming it', () => {
      const rule = { valueType: 'string', valueFormat: 'e164' };
      expectValid(rule, ['+15556192191', ' +442071838750 ', '+12']);
      expectInvalid(rule, [
        '15556192191',
        '+05556192191',
        '+1 555 619 2191',
        '+1-555-619-2191',
        '+1234567890123456',
        '+1',
        '',
        15556192191,
      ]);
    });

    it('should accept any non-blank string, number or boolean for a rule without a value type', () => {
      const rule = {};
      expectValid(rule, ['EMP-1', 12345, 0, true, false]);
      expectInvalid(rule, ['', '   ', null, undefined, {}, []]);
    });

    it('should accept nothing for an unknown value type or value format', () => {
      expectInvalid({ valueType: 'date' }, ['2026-01-01', 12345, true]);
      expectInvalid({ valueType: 'constructor' }, ['EMP-1', 12345, true]);
      expectInvalid({ valueType: 'string', valueFormat: 'phone' }, [
        '+15556192191',
      ]);
      expectInvalid({ valueType: 'string', valueFormat: 'toString' }, [
        'EMP-1',
      ]);
    });
  });

  describe('isOfValueType', () => {
    it('should check the type without converting the value', () => {
      expect(isOfValueType('number')(12345)).toEqual(true);
      expect(isOfValueType('number')('12345')).toEqual(false);
      expect(isOfValueType('string')(12345)).toEqual(false);
      expect(isOfValueType('boolean')('true')).toEqual(false);
    });

    it('should accept a blank string, which only depots refuse', () => {
      expect(isOfValueType('string')('')).toEqual(true);
    });

    it('should accept any string, number or boolean without a value type', () => {
      const isOfAnyType = isOfValueType(undefined);
      expect([
        isOfAnyType('a'),
        isOfAnyType(1),
        isOfAnyType(false),
        isOfAnyType(null),
        isOfAnyType({}),
      ]).toEqual([true, true, true, false, false]);
    });
  });
});
