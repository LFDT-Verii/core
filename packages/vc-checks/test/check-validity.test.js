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
const { checkValidity } = require('../src/check-validity');
const { CheckResults } = require('../src/check-results');

const now = Date.parse('2026-08-13T00:00:00.000Z');

describe('checkValidity', () => {
  it('passes at both inclusive v2 validity boundaries', () => {
    expect(
      checkValidity(
        {
          validFrom: '2026-08-13T00:00:00.000Z',
          validUntil: '2026-08-13T00:00:00.000Z',
        },
        now,
      ),
    ).toEqual(CheckResults.PASS);
  });

  it('fails before validFrom', () => {
    expect(
      checkValidity({ validFrom: '2026-08-13T00:00:00.001Z' }, now),
    ).toEqual(CheckResults.FAIL);
  });

  it('fails after validUntil', () => {
    expect(
      checkValidity({ validUntil: '2026-08-12T23:59:59.999Z' }, now),
    ).toEqual(CheckResults.FAIL);
  });

  it('does not let a legacy expirationDate alias override validUntil', () => {
    expect(
      checkValidity(
        {
          expirationDate: '2099-08-13T00:00:00.000Z',
          validUntil: '2026-08-12T23:59:59.999Z',
        },
        now,
      ),
    ).toEqual(CheckResults.FAIL);
  });

  it('does not use the legacy nested validity alias', () => {
    expect(
      checkValidity(
        {
          credentialSubject: {
            validity: { validUntil: '2026-08-13T00:00:00.000Z' },
          },
        },
        now,
      ),
    ).toEqual(CheckResults.NOT_APPLICABLE);
  });

  it('is not applicable without either validity bound', () => {
    expect(checkValidity({}, now)).toEqual(CheckResults.NOT_APPLICABLE);
  });

  it('fails closed for unparseable validity bounds', () => {
    expect(checkValidity({ validFrom: '2099-12-31T23:59:60Z' }, now)).toEqual(
      CheckResults.FAIL,
    );
    expect(checkValidity({ validUntil: 'not-a-date' }, now)).toEqual(
      CheckResults.FAIL,
    );
  });
});
