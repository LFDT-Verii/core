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
const { coerceArray } = require('../src/coerce-array');

describe('coerce array', () => {
  it('should return undefined if input is undefined', () => {
    expect(coerceArray(undefined)).toEqual(undefined);
  });

  it('should return undefined if input is null', () => {
    expect(coerceArray(null)).toEqual(undefined);
  });

  it('should return undefined if input is empty array', () => {
    expect(coerceArray([])).toEqual(undefined);
  });

  it('should wrap non-array values in an array', () => {
    expect(coerceArray(42)).toEqual([42]);
    expect(coerceArray('test')).toEqual(['test']);
    expect(coerceArray({ foo: 'bar' })).toEqual([{ foo: 'bar' }]);
  });

  it('should return the same array if input is already an array', () => {
    const input = [1, 2, 3];
    expect(coerceArray(input)).toEqual(input); // same reference
  });

  it('should treat empty string as a single-element array', () => {
    expect(coerceArray('')).toEqual(['']);
  });

  it('should not coerce objects with length property into arrays', () => {
    const obj = { length: 2, 0: 'a', 1: 'b' };
    expect(coerceArray(obj)).toEqual([obj]);
  });
});
