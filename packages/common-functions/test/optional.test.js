/**
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
 */
const { describe, it } = require('node:test');
const { expect } = require('expect');

const { optional } = require('../src/optional');

describe('optional Test Suite', () => {
  it('should error when first argument is not a function', () => {
    expect(() => optional(123, [])).toThrow(
      'First argument must be a function'
    );
  });
  it('should error when second argument is not an array', () => {
    expect(() => optional(() => {}, {})).toThrow(
      'Second argument must be an array'
    );
  });
  it('should return null when any parameter is null or undefined', () => {
    const result = optional(() => 'test', [null]);
    expect(result).toBeNull();
  });
  it('should execute function with parameters when all parameters are not null nor undefined', () => {
    const result = optional((a, b) => a + b, [1, 2]);
    expect(result).toBe(3);
  });
  it('should execute async function with parameters when all parameters are not null nor undefined', async () => {
    const asyncFunc = async (a, b) => a + b;
    const optionalFunc = () => optional(asyncFunc, [1, 2]);
    await expect(optionalFunc()).resolves.toEqual(3);
  });
});
