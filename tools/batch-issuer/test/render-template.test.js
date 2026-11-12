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
  checkTemplateSyntax,
  renderTemplate,
} = require('../src/templates/render-template');

describe('renderTemplate', () => {
  it('renders each string of the template with the row', () => {
    const template = {
      type: ['OpenBadgeCredential'],
      credentialSubject: {
        name: '{{firstName}} {{lastName}}',
        achievement: { name: 'IVIE', alignment: [{ targetCode: '{{code}}' }] },
      },
    };
    expect(
      renderTemplate(template, {
        firstName: 'Adam',
        lastName: 'Smith',
        code: 'NDMEP3',
      }),
    ).toEqual({
      value: {
        type: ['OpenBadgeCredential'],
        credentialSubject: {
          name: 'Adam Smith',
          achievement: { name: 'IVIE', alignment: [{ targetCode: 'NDMEP3' }] },
        },
      },
      errors: [],
    });
  });

  it('keeps keys, numbers, booleans and nulls as they are', () => {
    const template = { '{{key}}': 1, flag: true, none: null, list: [2, false] };
    expect(renderTemplate(template, { key: 'x' })).toEqual({
      value: template,
      errors: [],
    });
  });

  it('renders a single string', () => {
    expect(renderTemplate('{{employeeId}}-ivie', { employeeId: 'E1' })).toEqual(
      {
        value: 'E1-ivie',
        errors: [],
      },
    );
  });

  it('keeps a missing template missing', () => {
    expect(renderTemplate(undefined, {})).toEqual({
      value: undefined,
      errors: [],
    });
  });

  describe('CSV values cannot change the structure', () => {
    const template = {
      credentialSubject: { name: '{{name}}', role: 'member' },
    };

    it('keeps quotes, braces and commas inside the string', () => {
      const name = 'Adam", "role": "admin", "x": {"y": "';
      const { value, errors } = renderTemplate(template, { name });
      expect(errors).toEqual([]);
      expect(value).toEqual({ credentialSubject: { name, role: 'member' } });
      expect(JSON.parse(JSON.stringify(value))).toEqual(value);
    });

    it('does not HTML-escape values', () => {
      const name = '<b>O\'Brien & "Sons"</b>';
      expect(
        renderTemplate(template, { name }).value.credentialSubject.name,
      ).toEqual(name);
    });

    it('does not render Handlebars in a value', () => {
      const name = '{{role}} {{#each this}}{{@key}}{{/each}}';
      expect(
        renderTemplate(template, { name, role: 'admin' }).value
          .credentialSubject.name,
      ).toEqual(name);
    });

    it('does not read inherited properties', () => {
      expect(renderTemplate('{{constructor}}', {})).toEqual({
        errors: [{ column: 'constructor', reason: 'is missing' }],
      });
      expect(renderTemplate('{{constructor}}', { constructor: 'x' })).toEqual({
        value: 'x',
        errors: [],
      });
    });
  });

  describe('typed columns', () => {
    const columns = {
      creditsEarned: 'number',
      active: 'boolean',
      code: 'string',
    };

    it('gives a value that is exactly a placeholder its column type', () => {
      const template = {
        creditsEarned: '{{creditsEarned}}',
        active: '{{ active }}',
        code: '{{code}}',
        list: ['{{creditsEarned}}'],
      };
      expect(
        renderTemplate(
          template,
          { creditsEarned: '1.5', active: 'true', code: '007' },
          columns,
        ),
      ).toEqual({
        value: { creditsEarned: 1.5, active: true, code: '007', list: [1.5] },
        errors: [],
      });
    });

    it('supports a bracketed column name', () => {
      expect(
        renderTemplate(
          '{{[credits earned]}}',
          { 'credits earned': '2' },
          { 'credits earned': 'number' },
        ),
      ).toEqual({ value: 2, errors: [] });
    });

    it('renders a typed column inside a longer string as text', () => {
      expect(
        renderTemplate(
          '{{creditsEarned}} credits',
          { creditsEarned: '1.5' },
          columns,
        ),
      ).toEqual({ value: '1.5 credits', errors: [] });
    });

    it('keeps an undeclared column a string', () => {
      expect(renderTemplate('{{year}}', { year: '2026' }, columns)).toEqual({
        value: '2026',
        errors: [],
      });
    });

    it('reports a value that does not convert', () => {
      expect(
        renderTemplate(
          { a: '{{creditsEarned}}', b: '{{active}}' },
          { creditsEarned: 'two', active: 'yes' },
          columns,
        ),
      ).toEqual({
        value: { a: undefined, b: undefined },
        errors: [
          { column: 'creditsEarned', reason: '"two" is not a number' },
          { column: 'active', reason: '"yes" is not true or false' },
        ],
      });
    });

    it('reports a missing typed column', () => {
      expect(renderTemplate('{{creditsEarned}}', {}, columns).errors).toEqual([
        { column: 'creditsEarned', reason: 'is missing' },
      ]);
    });
  });

  describe('strict mode', () => {
    it('reports each missing column', () => {
      expect(
        renderTemplate(
          { name: '{{firstName}} {{lastName}}', id: '{{id}}' },
          { firstName: 'Adam' },
        ).errors,
      ).toEqual([
        { column: 'lastName', reason: 'is missing' },
        { column: 'id', reason: 'is missing' },
      ]);
    });

    it('renders an empty cell as an empty string', () => {
      expect(renderTemplate('[{{middleName}}]', { middleName: '' })).toEqual({
        value: '[]',
        errors: [],
      });
    });

    it('reports another rendering error', () => {
      const { errors } = renderTemplate('{{name.first}}', { name: 'Adam' });
      expect(errors).toEqual([{ reason: expect.any(String) }]);
    });
  });
});

describe('checkTemplateSyntax', () => {
  it('finds no errors in valid templates', () => {
    expect(
      checkTemplateSyntax({
        a: '{{x}}',
        b: ['{{#if y}}y{{/if}}', 1, null],
        c: { d: 'plain' },
      }),
    ).toEqual([]);
  });

  it('reports each string with a syntax error', () => {
    const errors = checkTemplateSyntax({
      a: '{{x',
      b: ['ok', '{{#if y}}y{{/each}}'],
    });
    expect(errors).toEqual([
      expect.stringContaining('Parse error on line 1'),
      "if doesn't match each - 1:3",
    ]);
  });
});
