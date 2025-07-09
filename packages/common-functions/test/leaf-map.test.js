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

const { leafMap } = require('../src/leafMap');

describe('leafMap Test Suite', () => {
  it('should call func to transform each leaf', () => {
    const impl = (val) => {
      return val === 'bar' ? 'baz' : val;
    };
    const fn = jest.fn().mockImplementation(impl);
    expect(leafMap(fn, null)).toEqual(null);
    expect(leafMap(fn, true)).toEqual(true);
    expect(leafMap(fn, undefined)).toEqual(undefined);
    expect(leafMap(fn, NaN)).toEqual(NaN);
    expect(leafMap(fn, 0)).toEqual(0);
    expect(leafMap(fn, {})).toEqual({});
    expect(leafMap(fn, [])).toEqual([]);
    expect(leafMap(fn, { foo: null })).toEqual({ foo: null });
    expect(leafMap(fn, [undefined])).toEqual([undefined]);
    expect(leafMap(fn, 'bar')).toEqual('baz');
    expect(leafMap(fn, ['bar'])).toEqual(['baz']);
    expect(leafMap(fn, ['bar', { foo: 'bar' }])).toEqual([
      'baz',
      { foo: 'baz' },
    ]);
    expect(leafMap(fn, { arr: ['bar', { foo: 'bar' }] })).toEqual({
      arr: ['baz', { foo: 'baz' }],
    });
    expect(
      leafMap(fn, {
        arr: ['bar', { foo: 'bar' }, null],
        foo: 'bar',
        bar: 'foo',
      })
    ).toEqual({
      arr: ['baz', { foo: 'baz' }, null],
      foo: 'baz',
      bar: 'foo',
    });
    expect(leafMap(fn, { foo: { foo: { foo: 'bar' } } })).toEqual({
      foo: { foo: { foo: 'baz' } },
    });
  });
});
