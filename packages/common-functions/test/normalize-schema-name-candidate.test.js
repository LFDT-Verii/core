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

const { kebabCase } = require('lodash/fp');
const {
  normalizeDisplayDescriptorName,
  normalizeJsonSchemaName,
  normalizeFormSchemaName,
} = require('../index');

describe('schema name normalization test suite', () => {
  it('should handle unversioned strings', () => {
    const name = normalizeJsonSchemaName('foo');
    expect(name).toEqual('foo');
  });
  it('should handle kebab cased unversioned strings', () => {
    const name = normalizeJsonSchemaName('foo-bar');
    expect(name).toEqual('foo-bar');
  });
  it('should handle versioned strings', () => {
    const name = normalizeJsonSchemaName('foo-v1.0');
    expect(name).toEqual('foo-v1.0');
  });
  it('should handle kebab cased versioned strings', () => {
    const name = normalizeJsonSchemaName('foo-v-1-0');
    expect(name).toEqual('foo-v1.0');
  });
  it('should handle open badge version 2 schema name', () => {
    const name = normalizeJsonSchemaName('open-badge-v2.0');
    expect(name).toEqual('open-badge-v2.0');
  });
  it('should handle open badge version 2 schema name with file suffix', () => {
    const name = normalizeJsonSchemaName('open-badge-v2.0.schema.json');
    expect(name).toEqual('open-badge-v2.0');
  });
  it('should handle open badge version 2 form schema name with file suffix', () => {
    const name = normalizeFormSchemaName('open-badge-v2.0.form-schema.json');
    expect(name).toEqual('open-badge-v2.0');
  });
  it('should handle open badge version 2 display descriptor name with file suffix', () => {
    const name = normalizeDisplayDescriptorName(
      'open-badge-v2.0.descriptor.json'
    );
    expect(name).toEqual('open-badge-v2.0');
  });
  it('should handle open badge version 2 credential type', () => {
    const name = normalizeJsonSchemaName('OpenBadgeV2.0');
    expect(name).toEqual('open-badge-v2.0');
  });
  it('should handle recursive call for normalizeJsonSchemaName', () => {
    const name = normalizeJsonSchemaName('OpenBadgeV2.0');
    expect(name).toEqual('open-badge-v2.0');
    const name2 = normalizeJsonSchemaName(name);
    expect(name2).toEqual('open-badge-v2.0');
    const kebabName = kebabCase(name);
    expect(kebabName).toEqual('open-badge-v-2-0');
    const name3 = normalizeJsonSchemaName(kebabName);
    expect(name3).toEqual('open-badge-v2.0');
  });

  it('should handle recursive call for normalizeFormSchemaName', () => {
    const name = normalizeFormSchemaName('OpenBadgeV2.0');
    expect(name).toEqual('open-badge-v2.0');
    const name2 = normalizeFormSchemaName(name);
    expect(name2).toEqual('open-badge-v2.0');
    const kebabName = kebabCase(name);
    expect(kebabName).toEqual('open-badge-v-2-0');
    const name3 = normalizeFormSchemaName(kebabName);
    expect(name3).toEqual('open-badge-v2.0');
  });

  it('should handle recursive call for normalizeDisplayDescriptorName', () => {
    const name = normalizeDisplayDescriptorName('OpenBadgeV2.0');
    expect(name).toEqual('open-badge-v2.0');
    const name2 = normalizeDisplayDescriptorName(name);
    expect(name2).toEqual('open-badge-v2.0');
    const kebabName = kebabCase(name);
    expect(kebabName).toEqual('open-badge-v-2-0');
    const name3 = normalizeDisplayDescriptorName(kebabName);
    expect(name3).toEqual('open-badge-v2.0');
  });
});
