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
const { describe, it } = require('node:test');
const { expect } = require('expect');

const { isString } = require('lodash/fp');
const { filterValidEntities } = require('../index');

describe('filter valid entities', () => {
  it('should handle empty arrays', () => {
    const filter = filterValidEntities(() => {});
    expect(filter(null)).toEqual([]);
    expect(filter(undefined)).toEqual([]);
    expect(filter([])).toEqual([]);
  });
  it('should remove all invalid entries', () => {
    const filter = filterValidEntities(() => {
      throw new Error();
    });
    expect(filter([])).toEqual([]);
    expect(filter([1])).toEqual([]);
    expect(filter(['hi', 1, true])).toEqual([]);
  });
  it('should retain all valid entries', () => {
    const filter = filterValidEntities(() => {});
    expect(filter([])).toEqual([]);
    expect(filter([1])).toEqual([1]);
    expect(filter(['hi', 1, true])).toEqual(['hi', 1, true]);
  });
  it('should retain valid entries and remove invalid entries', () => {
    const filter = filterValidEntities((x) => {
      if (isString(x)) {
        throw new Error();
      }
    });

    expect(filter([])).toEqual([]);
    expect(filter([1])).toEqual([1]);
    expect(filter(['hi'])).toEqual([]);
    expect(filter(['hi', 1, true])).toEqual([1, true]);
  });
});
