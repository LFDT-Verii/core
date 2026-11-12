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
const {
  buildAuthMatchValues,
  toAuthMatchValue,
} = require('../src/auth-match-values');

describe('auth match values', () => {
  describe('toAuthMatchValue', () => {
    it('should trim and lower-case a string', () => {
      expect(toAuthMatchValue('  Adam@Example.COM\t')).toEqual(
        'adam@example.com',
      );
    });

    it('should leave numbers and booleans as they are', () => {
      expect(toAuthMatchValue(12345)).toEqual(12345);
      expect(toAuthMatchValue(0)).toEqual(0);
      expect(toAuthMatchValue(true)).toEqual(true);
      expect(toAuthMatchValue(false)).toEqual(false);
    });

    it('should not convert a number to a string or a string to a number', () => {
      expect(toAuthMatchValue('12345')).toEqual('12345');
      expect(toAuthMatchValue(12345)).not.toEqual('12345');
    });

    it('should leave other values as they are', () => {
      expect(toAuthMatchValue(null)).toEqual(null);
      expect(toAuthMatchValue(undefined)).toEqual(undefined);
    });
  });

  describe('buildAuthMatchValues', () => {
    it('should normalize each value, keeping their order', () => {
      expect(buildAuthMatchValues([' B@x.com ', 12345, true, 'a'])).toEqual([
        'b@x.com',
        12345,
        true,
        'a',
      ]);
    });

    it('should keep values that normalize to the same value', () => {
      expect(buildAuthMatchValues(['A@x.com', 'a@x.com '])).toEqual([
        'a@x.com',
        'a@x.com',
      ]);
    });

    it('should build no values from no auth values', () => {
      expect(buildAuthMatchValues([])).toEqual([]);
      expect(buildAuthMatchValues(undefined)).toEqual([]);
    });
  });
});
