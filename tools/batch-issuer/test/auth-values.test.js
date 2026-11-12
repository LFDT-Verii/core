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
const { buildAuthValues } = require('../src/values/auth-values');
const { emailRule, phoneRule } = require('./helpers/fixtures');

const emailColumn = { column: 'email', rule: emailRule };
const phoneColumn = { column: 'phone', rule: phoneRule };

describe('buildAuthValues', () => {
  it('builds the values in the order of the auth columns', () => {
    expect(
      buildAuthValues(
        [emailColumn, phoneColumn],
        { phone: '+1 555 619 2191', email: ' Adam@Example.com ' },
        {},
      ),
    ).toEqual({ authValues: ['Adam@Example.com', '+15556192191'], errors: [] });
  });

  it('does not read an inherited property for a missing column', () => {
    expect(
      buildAuthValues(
        [{ column: 'constructor', rule: { ...emailRule, type: 'IdV1.0' } }],
        {},
        {},
      ),
    ).toEqual({ errors: [{ column: 'constructor', reason: 'is missing' }] });
  });

  it('builds no values for no auth columns', () => {
    expect(buildAuthValues([], { email: 'a@example.com' }, {})).toEqual({
      authValues: [],
      errors: [],
    });
  });

  it('reports a missing or blank value', () => {
    expect(
      buildAuthValues([emailColumn, phoneColumn], { email: '  ' }, {}),
    ).toEqual({
      errors: [
        { column: 'email', reason: 'is blank' },
        { column: 'phone', reason: 'is missing' },
      ],
    });
  });

  describe('value types', () => {
    const numberRule = {
      ...emailRule,
      type: 'EmployeeIdV1.0',
      valueType: 'number',
    };
    const booleanRule = {
      ...emailRule,
      type: 'MemberV1.0',
      valueType: 'boolean',
    };

    it("converts a value to its rule's valueType", () => {
      expect(
        buildAuthValues(
          [
            { column: 'id', rule: numberRule },
            { column: 'member', rule: { ...booleanRule, valueIndex: 1 } },
          ],
          { id: ' 12345 ', member: 'TRUE' },
          {},
        ),
      ).toEqual({ authValues: [12345, true], errors: [] });
    });

    it('reports a value that does not convert', () => {
      expect(
        buildAuthValues(
          [{ column: 'id', rule: numberRule }],
          { id: 'E12345' },
          {},
        ),
      ).toEqual({
        errors: [{ column: 'id', reason: '"E12345" is not a number' }],
      });
    });

    it('treats a rule without a valueType as a string rule', () => {
      const rule = { ...emailRule, type: 'EmployeeIdV1.0' };
      expect(
        buildAuthValues([{ column: 'id', rule }], { id: ' 12345 ' }, {}),
      ).toEqual({ authValues: ['12345'], errors: [] });
    });

    it('does not format a value of a non-string rule', () => {
      const rule = { ...phoneRule, valueIndex: 0, valueType: 'number' };
      expect(
        buildAuthValues(
          [{ column: 'phone', rule }],
          { phone: '5556192191' },
          {},
        ),
      ).toEqual({ authValues: [5556192191], errors: [] });
    });
  });

  describe('phone numbers', () => {
    const check = (phone, options = {}, rule = phoneRule) =>
      buildAuthValues([{ column: 'phone', rule }], { phone }, options);

    it('normalizes a PhoneV1.0 value to E.164', () => {
      expect(check('+1 (555) 619-2191')).toEqual({
        authValues: ['+15556192191'],
        errors: [],
      });
      expect(check('+61 412 345 678')).toEqual({
        authValues: ['+61412345678'],
        errors: [],
      });
    });

    it('uses the default country for a number without a country code', () => {
      expect(check('0412 345 678', { defaultCountry: 'AU' })).toEqual({
        authValues: ['+61412345678'],
        errors: [],
      });
      expect(check('(555) 619-2191', { defaultCountry: 'US' })).toEqual({
        authValues: ['+15556192191'],
        errors: [],
      });
    });

    it('keeps the country code of a number that has one', () => {
      expect(check('+1 555 619 2191', { defaultCountry: 'AU' })).toEqual({
        authValues: ['+15556192191'],
        errors: [],
      });
    });

    it('normalizes a value of a rule with the e164 valueFormat', () => {
      const rule = { ...emailRule, type: 'MobileV1.0', valueFormat: 'e164' };
      expect(check('+1 555 619 2191', {}, rule)).toEqual({
        authValues: ['+15556192191'],
        errors: [],
      });
    });

    it('says a number without a country code needs --default-country', () => {
      expect(check('5556192191')).toEqual({
        errors: [
          {
            column: 'phone',
            reason:
              '"5556192191" is not a phone number. It has no country code, so pass --default-country',
          },
        ],
      });
    });

    it('reports a number that cannot be normalized', () => {
      for (const phone of ['12', 'call me', '+1 555', '+999 1234567']) {
        expect(check(phone, { defaultCountry: 'US' })).toEqual({
          errors: [
            { column: 'phone', reason: `"${phone}" is not a phone number` },
          ],
        });
      }
    });
  });

  describe('email addresses', () => {
    const check = (email, rule = emailRule) =>
      buildAuthValues([{ column: 'email', rule }], { email }, {});

    it('accepts an EmailV1.0 value that is an email address', () => {
      expect(check('Beth.Jones+work@Example.com')).toEqual({
        authValues: ['Beth.Jones+work@Example.com'],
        errors: [],
      });
    });

    it('reports an EmailV1.0 value that is not an email address', () => {
      for (const email of [
        'adam',
        'adam@',
        '@example.com',
        'adam smith@example.com',
      ]) {
        expect(check(email)).toEqual({
          errors: [
            { column: 'email', reason: `"${email}" is not an email address` },
          ],
        });
      }
    });

    it('checks a value of a rule with the email valueFormat', () => {
      const rule = {
        ...emailRule,
        type: 'WorkEmailV1.0',
        valueFormat: 'email',
      };
      expect(check('adam', rule)).toEqual({
        errors: [{ column: 'email', reason: '"adam" is not an email address' }],
      });
    });

    it('does not check a value of another string rule', () => {
      const rule = { ...emailRule, type: 'EmployeeIdV1.0' };
      expect(check('adam', rule)).toEqual({ authValues: ['adam'], errors: [] });
    });
  });
});
