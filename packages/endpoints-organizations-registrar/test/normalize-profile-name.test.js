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

const { describe, it } = require('node:test');
const { expect } = require('expect');

const { normalizeProfileName } = require('../src/entities');

describe('normalizeProfileName Test Suite', () => {
  it('should be the same if name already normalized', () => {
    expect(normalizeProfileName('hello secret name')).toBe('hello secret name');
  });

  it('name normalization should remove all spaces and make it lowercase', () => {
    expect(normalizeProfileName('  Hello \t \tsecret name   ')).toBe(
      'hello secret name'
    );
  });

  it('special symbols should not be removed or escaped', () => {
    expect(normalizeProfileName('  Hello? \t *\t\n\nsecret name! ##$$  ')).toBe(
      'hello? * secret name! ##$$'
    );
  });
});
