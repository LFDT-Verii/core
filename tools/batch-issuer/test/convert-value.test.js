/**
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
 */

const { describe, it } = require('node:test');
const { expect } = require('expect');
const { convertValue } = require('../src/values/convert-value');

describe('convertValue', () => {
  it('keeps a string as it is', () => {
    expect(convertValue('string', ' a b ')).toEqual({ value: ' a b ' });
  });

  it('refuses a missing type', () => {
    expect(convertValue(undefined, '12345')).toEqual({
      reason: '"undefined" is not a value type',
    });
  });

  it('converts decimal numbers', () => {
    expect(convertValue('number', '12345')).toEqual({ value: 12345 });
    expect(convertValue('number', ' -1.5 ')).toEqual({ value: -1.5 });
    expect(convertValue('number', '007')).toEqual({ value: 7 });
    expect(convertValue('number', '1e3')).toEqual({ value: 1000 });
    expect(convertValue('number', '.5')).toEqual({ value: 0.5 });
  });

  it('refuses what is not a decimal number', () => {
    for (const text of [
      '',
      ' ',
      'abc',
      '0x10',
      'Infinity',
      '1,000',
      '1e999',
      'NaN',
    ]) {
      expect(convertValue('number', text)).toEqual({
        reason: `"${text}" is not a number`,
      });
    }
  });

  it('converts true and false, in any case', () => {
    expect(convertValue('boolean', 'true')).toEqual({ value: true });
    expect(convertValue('boolean', ' FALSE ')).toEqual({ value: false });
  });

  it('refuses other booleans', () => {
    for (const text of ['', 'yes', '1', 'constructor', 'toString']) {
      expect(convertValue('boolean', text)).toEqual({
        reason: `"${text}" is not true or false`,
      });
    }
  });

  it('refuses an unknown value type', () => {
    expect(convertValue('date', '2026-11-12')).toEqual({
      reason: '"date" is not a value type',
    });
    expect(convertValue('constructor', 'x')).toEqual({
      reason: '"constructor" is not a value type',
    });
  });
});
