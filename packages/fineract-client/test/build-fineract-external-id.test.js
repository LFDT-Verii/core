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
  FINERACT_EXTERNAL_ID_MAX_LENGTH,
  buildFineractExternalId,
} = require('../src/build-fineract-external-id');

describe('buildFineractExternalId', () => {
  const organizationId = '66d8f4f2a1b2c3d4e5f60718';

  it('should namespace the organization ID', () => {
    expect(buildFineractExternalId(organizationId)).toEqual(
      `registrar:org:${organizationId}`,
    );
  });

  it('should append a relative account ID within the Fineract limit', () => {
    const externalId = buildFineractExternalId(
      organizationId,
      '#escrow-account',
    );

    expect(externalId).toEqual(
      `registrar:org:${organizationId}#escrow-account`,
    );
    expect(externalId.length).toBeLessThanOrEqual(
      FINERACT_EXTERNAL_ID_MAX_LENGTH,
    );
  });

  it('should throw when the organization ID is missing', () => {
    expect(() => buildFineractExternalId(undefined)).toThrow(
      'organizationId is required',
    );
    expect(() => buildFineractExternalId(null, '#escrow-account')).toThrow(
      'organizationId is required',
    );
    expect(() => buildFineractExternalId('')).toThrow(
      'organizationId is required',
    );
  });

  it('should throw when the external ID exceeds the Fineract limit', () => {
    expect(() =>
      buildFineractExternalId('x'.repeat(FINERACT_EXTERNAL_ID_MAX_LENGTH)),
    ).toThrow(`exceeds ${FINERACT_EXTERNAL_ID_MAX_LENGTH} characters`);
  });
});
