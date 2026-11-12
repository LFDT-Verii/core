/*
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
 *
 */

const { describe, it } = require('node:test');
const { expect } = require('expect');
const { ruleValues, selectClaims } = require('../src/vp-auth-rules');

const emailRule = (overrides) => ({
  path: [['credentialSubject', 'email']],
  rule: 'pick',
  valueIndex: 0,
  type: 'EmailV1.0',
  ...overrides,
});

// A verified credential with the type computed from it.
const verified = (type, credentialSubject) => ({
  type,
  credential: { credentialSubject },
});
const emailCredential = (email) => verified('EmailV1.0', { email });

describe('vp auth rules', () => {
  describe('ruleValues', () => {
    it('should return the distinct normalized values found in all the credentials', () => {
      expect(
        ruleValues(emailRule(), [
          emailCredential(' Adam@Example.com '),
          emailCredential('adam@example.com'),
          emailCredential('jane@example.com'),
        ]),
      ).toEqual(['adam@example.com', 'jane@example.com']);
    });

    it('should use the first path that finds anything in each credential', () => {
      const rule = emailRule({
        path: [
          ['credentialSubject', 'emailAddress'],
          ['credentialSubject', 'email'],
        ],
      });
      expect(
        ruleValues(rule, [
          verified('EmailV1.0', {
            emailAddress: 'first@example.com',
            email: 'second@example.com',
          }),
          emailCredential('only@example.com'),
        ]),
      ).toEqual(['first@example.com', 'only@example.com']);
    });

    describe('pointer alternatives', () => {
      const rule = emailRule({
        path: [
          ['credentialSubject', 'primaryEmail'],
          ['credentialSubject', 'email'],
        ],
      });

      it('should fall through a pointer that selects only null', () => {
        expect(
          ruleValues(rule, [
            verified('EmailV1.0', { primaryEmail: null, email: 'A@x.com' }),
          ]),
        ).toEqual(['a@x.com']);
      });

      it('should fall through a pointer that selects an object or an array', () => {
        expect(
          ruleValues(rule, [
            verified('EmailV1.0', {
              primaryEmail: { value: 'p@x.com' },
              email: 'a@x.com',
            }),
            verified('EmailV1.0', {
              primaryEmail: ['q@x.com'],
              email: 'b@x.com',
            }),
          ]),
        ).toEqual(['a@x.com', 'b@x.com']);
      });

      it('should use a pointer that selects a usable value', () => {
        expect(
          ruleValues(rule, [
            verified('EmailV1.0', {
              primaryEmail: 'P@x.com',
              email: 'a@x.com',
            }),
          ]),
        ).toEqual(['p@x.com']);
      });

      it('should use a pointer whose selection mixes null and usable values', () => {
        const nullSegmentRule = emailRule({
          path: [
            ['credentialSubject', 'emails', null],
            ['credentialSubject', 'email'],
          ],
        });
        expect(
          ruleValues(nullSegmentRule, [
            verified('EmailV1.0', {
              emails: [null, 'C@x.com'],
              email: 'a@x.com',
            }),
          ]),
        ).toEqual(['c@x.com']);
      });
    });

    it('should keep scalars only', () => {
      const rule = emailRule({ path: [['credentialSubject', 'values', null]] });
      expect(
        ruleValues(rule, [
          verified('EmailV1.0', {
            values: ['A@x.com', 1, true, null, { email: 'b@x.com' }, ['c']],
          }),
        ]),
      ).toEqual(['a@x.com', 1, true]);
    });

    it('should drop a selected array, which a null segment would expand', () => {
      const rule = emailRule({ path: [['credentialSubject', 'values']] });
      expect(
        ruleValues(rule, [verified('EmailV1.0', { values: ['a@x.com'] })]),
      ).toEqual([]);
    });

    it('should return no values when no path finds anything', () => {
      expect(
        ruleValues(emailRule(), [verified('EmailV1.0', { phone: '+1555' })]),
      ).toEqual([]);
    });

    it("should read only credentials of the rule's type", () => {
      expect(
        ruleValues(emailRule(), [
          verified('PhoneV1.0', { phone: '+1555', email: 'victim@x.com' }),
          emailCredential('own@x.com'),
        ]),
      ).toEqual(['own@x.com']);
    });

    it('should read nothing for a rule without a type', () => {
      expect(
        ruleValues(emailRule({ type: undefined }), [
          emailCredential('a@x.com'),
        ]),
      ).toEqual([]);
    });

    it('should read nothing through a JSONPath string', () => {
      const rule = emailRule({ path: ['$.credentialSubject.email'] });
      expect(ruleValues(rule, [emailCredential('a@x.com')])).toEqual([]);
    });
  });

  describe('selectClaims', () => {
    const credential = {
      credentialSubject: {
        email: 'a@x.com',
        emails: ['b@x.com', 'c@x.com'],
        contacts: [
          { email: 'd@x.com' },
          { email: 'e@x.com' },
          { phone: '+1555' },
          'f@x.com',
        ],
        matrix: [['g', 'h'], ['i']],
        nothing: null,
      },
    };

    it('should select a key of an object', () => {
      expect(selectClaims(['credentialSubject', 'email'], credential)).toEqual([
        'a@x.com',
      ]);
    });

    it('should select an index of an array', () => {
      expect(
        selectClaims(['credentialSubject', 'emails', 1], credential),
      ).toEqual(['c@x.com']);
    });

    it('should select every element of an array with null', () => {
      expect(
        selectClaims(['credentialSubject', 'emails', null], credential),
      ).toEqual(['b@x.com', 'c@x.com']);
    });

    it('should apply the next segment to every selected element', () => {
      expect(
        selectClaims(
          ['credentialSubject', 'contacts', null, 'email'],
          credential,
        ),
      ).toEqual(['d@x.com', 'e@x.com']);
    });

    it('should walk nested arrays', () => {
      expect(
        selectClaims(['credentialSubject', 'matrix', null, null], credential),
      ).toEqual(['g', 'h', 'i']);
      expect(
        selectClaims(['credentialSubject', 'matrix', 0, 1], credential),
      ).toEqual(['h']);
      expect(
        selectClaims(['credentialSubject', 'matrix', null, 0], credential),
      ).toEqual(['g', 'i']);
    });

    it('should select nothing for a missing key or index', () => {
      expect(selectClaims(['credentialSubject', 'phone'], credential)).toEqual(
        [],
      );
      expect(
        selectClaims(['credentialSubject', 'emails', 2], credential),
      ).toEqual([]);
    });

    it('should select nothing when a segment does not fit the element', () => {
      const mismatches = [
        ['credentialSubject', 'emails', 'email'],
        ['credentialSubject', 0],
        ['credentialSubject', null],
        ['credentialSubject', 'email', 'length'],
        ['credentialSubject', 'email', 0],
        ['credentialSubject', 'email', null],
        ['credentialSubject', 'nothing', 'email'],
      ];
      for (const pointer of mismatches) {
        expect(selectClaims(pointer, credential)).toEqual([]);
      }
    });

    it('should select own keys only', () => {
      expect(
        selectClaims(['credentialSubject', 'constructor'], credential),
      ).toEqual([]);
      expect(selectClaims(['__proto__'], credential)).toEqual([]);
      expect(
        selectClaims(['credentialSubject', 'toString'], credential),
      ).toEqual([]);
    });

    it('should select inherited keys of a nested object as nothing', () => {
      for (const key of ['toString', 'hasOwnProperty', 'valueOf']) {
        expect(
          selectClaims(['credentialSubject', 'contacts', 0, key], credential),
        ).toEqual([]);
      }
    });

    it('should select an own __proto__ key of a decoded credential', () => {
      const decoded = JSON.parse(
        '{"credentialSubject":{"__proto__":{"email":"a@x.com"}}}',
      );
      expect(
        selectClaims(['credentialSubject', '__proto__', 'email'], decoded),
      ).toEqual(['a@x.com']);
    });

    it('should read a key with dots or brackets as the key, not as a path', () => {
      const withPathLikeKeys = {
        credentialSubject: {
          'a.b': 'key a.b',
          a: { b: 'path a.b' },
          'c[0]': 'key c[0]',
          c: ['path c[0]'],
          'd.0': 'key d.0',
          d: ['path d.0'],
        },
      };
      expect(
        selectClaims(['credentialSubject', 'a.b'], withPathLikeKeys),
      ).toEqual(['key a.b']);
      expect(
        selectClaims(['credentialSubject', 'c[0]'], withPathLikeKeys),
      ).toEqual(['key c[0]']);
      expect(
        selectClaims(['credentialSubject', 'd.0'], withPathLikeKeys),
      ).toEqual(['key d.0']);
      expect(
        selectClaims(['credentialSubject', 'x.y'], withPathLikeKeys),
      ).toEqual([]);
      expect(
        selectClaims(['credentialSubject', 'a.b'], {
          credentialSubject: { a: { b: 'path a.b' } },
        }),
      ).toEqual([]);
    });

    it("should select nothing for an array's or a string's length", () => {
      expect(
        selectClaims(['credentialSubject', 'emails', 'length'], credential),
      ).toEqual([]);
      expect(
        selectClaims(['credentialSubject', 'email', 'length'], credential),
      ).toEqual([]);
    });

    it('should select an element of a sparse array as undefined', () => {
      // ['a@x.com', <hole>, 'c@x.com']
      const emails = ['a@x.com'];
      emails[2] = 'c@x.com';
      const sparse = { credentialSubject: { emails } };
      expect(selectClaims(['credentialSubject', 'emails', 1], sparse)).toEqual([
        undefined,
      ]);
      expect(selectClaims(['credentialSubject', 'emails', 3], sparse)).toEqual(
        [],
      );
    });

    it('should return non-scalars as they are', () => {
      expect(
        selectClaims(['credentialSubject', 'nothing'], credential),
      ).toEqual([null]);
      expect(selectClaims(['credentialSubject', 'emails'], credential)).toEqual(
        [['b@x.com', 'c@x.com']],
      );
    });

    it('should never throw on odd input', () => {
      const pointers = [
        undefined,
        null,
        'credentialSubject',
        {},
        [],
        [{}],
        [[]],
        [true],
        [-1],
        [1.5],
        [Number.NaN],
        [Number.POSITIVE_INFINITY],
        [Symbol('key')],
        ['credentialSubject', -1],
      ];
      const credentials = [undefined, null, 1, 'string', [], credential];
      for (const pointer of pointers) {
        for (const json of credentials) {
          expect(selectClaims(pointer, json)).toEqual([]);
        }
      }
    });
  });
});
