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

const { nanoid } = require('nanoid/non-secure');
const { dateify } = require('../src/dateify');

describe('dateify', () => {
  it('should handle null dates', () => {
    const obj = { createdAt: new Date().toISOString(), id: nanoid() };
    expect(dateify(null)(obj)).toEqual(obj);
  });
  it('should handle empty dates', () => {
    const obj = { createdAt: new Date().toISOString(), id: nanoid() };
    expect(dateify([])(obj)).toEqual(obj);
  });
  it('should handle dates on null object', () => {
    const obj = null;
    expect(dateify(['createdAt'])(obj)).toEqual({});
  });
  it('should handle dates on empty object', () => {
    const obj = {};
    expect(dateify(['createdAt'])(obj)).toEqual(obj);
  });
  it('should handle dates on actual object', () => {
    const obj = { createdAt: new Date().toISOString(), id: nanoid() };
    expect(dateify(['createdAt'])(obj)).toEqual({
      ...obj,
      createdAt: new Date(obj.createdAt),
    });
  });
  it('should handle dates on actual object', () => {
    const obj = { createdAt: new Date().toISOString(), id: nanoid() };
    expect(dateify(['createdAt', 'updatedAt'])(obj)).toEqual({
      ...obj,
      createdAt: new Date(obj.createdAt),
    });
  });
});
