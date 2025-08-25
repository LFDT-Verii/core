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

const { idKeyMapper } = require('../src/idKeyMapper');

describe('idKeyMapper Test Suite', () => {
  it('should handle nulls', () => {
    expect(idKeyMapper(null)).toEqual(null);
  });

  it('should handle non objects properly', () => {
    expect(idKeyMapper('foo')).toEqual('foo');
  });

  it('should handle arrays properly properly', () => {
    expect(idKeyMapper([{ _id: 'foo' }])).toEqual([{ _id: 'foo', id: 'foo' }]);
  });
  it('should handle _id properly', () => {
    const obj = { _id: 'foo' };
    expect(idKeyMapper(obj)).toEqual({ _id: 'foo', id: 'foo' });
  });

  it('should not overwrite id if it exists', () => {
    const obj = { _id: 'foo', id: 'bar' };
    expect(idKeyMapper(obj)).toEqual({ _id: 'foo', id: 'bar' });
  });

  it('should handle nested objects properly', () => {
    const obj = { foo: { _id: 'foo' } };
    expect(idKeyMapper(obj)).toEqual({ foo: { _id: 'foo', id: 'foo' } });
  });

  it('should handle nested array of objects properly', () => {
    const obj = { foo: [{ _id: 'foo' }] };
    expect(idKeyMapper(obj)).toEqual({ foo: [{ _id: 'foo', id: 'foo' }] });
  });
  it('should handle nested array of primitives properly', () => {
    const obj = { foo: ['foo', 'bar'] };
    expect(idKeyMapper(obj)).toEqual({ foo: ['foo', 'bar'] });
  });
});
