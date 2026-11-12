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

const buildOne = (rule, cell, options = {}) =>
  buildAuthValues([{ column: 'cell', rule }], { cell }, options);

const value = (authValue) => ({ authValues: [authValue], errors: [] });
const error = (reason) => ({ errors: [{ column: 'cell', reason }] });

describe('buildAuthValues', () => {
  describe('routes each rule to its format', () => {
    const routes = [
      {
        name: 'a PhoneV1.0 rule normalizes to E.164',
        rule: phoneRule,
        cell: '+1 (555) 619-2191',
        result: value('+15556192191'),
      },
      {
        name: 'an e164 valueFormat normalizes to E.164',
        rule: { ...emailRule, type: 'MobileV1.0', valueFormat: 'e164' },
        cell: '+61 412 345 678',
        result: value('+61412345678'),
      },
      {
        name: 'an EmailV1.0 rule takes only an email address',
        rule: emailRule,
        cell: 'adam',
        result: error('"adam" is not an email address'),
      },
      {
        name: 'an email valueFormat takes only an email address',
        rule: { ...emailRule, type: 'WorkEmailV1.0', valueFormat: 'email' },
        cell: 'adam',
        result: error('"adam" is not an email address'),
      },
      {
        name: 'another string rule takes the trimmed cell',
        rule: { ...emailRule, type: 'EmployeeIdV1.0' },
        cell: ' adam ',
        result: value('adam'),
      },
      {
        name: 'a phone rule of another valueType takes the cell in that type',
        rule: { ...phoneRule, valueType: 'number' },
        cell: '5556192191',
        result: value(5556192191),
      },
    ];

    for (const { name, rule, cell, result } of routes) {
      it(name, () => {
        expect(buildOne(rule, cell)).toEqual(result);
      });
    }
  });

  it('uses the default country for a phone number without a country code', () => {
    expect(
      buildOne(phoneRule, '0412 345 678', { defaultCountry: 'AU' }),
    ).toEqual(value('+61412345678'));
  });

  it('says a phone number without a country code needs --default-country', () => {
    expect(buildOne(phoneRule, '5556192191')).toEqual(
      error(
        '"5556192191" is not a phone number. It has no country code, so pass --default-country',
      ),
    );
  });

  it('reports a blank or missing value', () => {
    expect(buildOne(emailRule, '  ')).toEqual(error('is blank'));
    expect(buildOne(emailRule, undefined)).toEqual(error('is missing'));
  });

  it('does not read an inherited property for a missing column', () => {
    const rule = { ...emailRule, type: 'IdV1.0' };
    expect(buildAuthValues([{ column: 'constructor', rule }], {}, {})).toEqual({
      errors: [{ column: 'constructor', reason: 'is missing' }],
    });
  });
});
