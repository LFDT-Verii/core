/**
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
 */

const { describe, it } = require('node:test');
const { expect } = require('expect');

const {
  buildFineractExternalId,
} = require('../src/build-fineract-external-id');

describe('buildFineractExternalId', () => {
  it('should namespace the organization ID', () => {
    const organizationId = '66d8f4f2a1b2c3d4e5f60718';

    expect(buildFineractExternalId(organizationId)).toEqual(
      `registrar:org:${organizationId}`,
    );
  });

  it('should append a relative account ID', () => {
    const organizationId = '66d8f4f2a1b2c3d4e5f60718';
    const externalId = buildFineractExternalId(
      organizationId,
      '#escrow-account',
    );

    expect(externalId).toEqual(
      `registrar:org:${organizationId}#escrow-account`,
    );
    expect(externalId).toHaveLength(53);
  });

  it('should serialize an object ID', () => {
    const organizationId = {
      toString: () => '66d8f4f2a1b2c3d4e5f60718',
    };

    expect(buildFineractExternalId(organizationId)).toEqual(
      'registrar:org:66d8f4f2a1b2c3d4e5f60718',
    );
  });
});
