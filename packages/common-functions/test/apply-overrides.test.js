/*
 * Copyright 2024 Velocity Team
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

const { applyOverrides } = require('../src/apply-overrides');

describe('apply overrides', () => {
  it('handles nil overrides', () => {
    expect(applyOverrides({})).toEqual({});
    expect(applyOverrides({ hello: 'world' })).toEqual({ hello: 'world' });
    expect(applyOverrides({}, null)).toEqual({});
    expect(applyOverrides({ hello: 'world' }, null)).toEqual({
      hello: 'world',
    });
    expect(applyOverrides({}, {})).toEqual({});
    expect(applyOverrides({ hello: 'world', b: 2 }, {})).toEqual({
      hello: 'world',
      b: 2,
    });
  });
  it('handles overrides', () => {
    expect(applyOverrides({}, { x: 1, 'p.s': 2 })).toEqual({
      x: 1,
      p: { s: 2 },
    });
    expect(applyOverrides({ hello: 'world' }, { x: 1, 'p.s': 2 })).toEqual({
      hello: 'world',
      x: 1,
      p: { s: 2 },
    });
    expect(
      applyOverrides(
        { hello: 'world' },
        { x: 1, combined: ({ hello, x }) => `${hello}-${x}` }
      )
    ).toEqual({
      hello: 'world',
      x: 1,
      combined: 'world-1',
    });
  });
});
