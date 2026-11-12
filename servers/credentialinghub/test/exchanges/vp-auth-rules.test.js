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
const { map, times } = require('lodash/fp');
const {
  buildCandidateTuples,
} = require('../../src/entities/exchanges/domain/vp-auth-rules');

const emailRule = (overrides) => ({
  path: [['credentialSubject', 'email']],
  rule: 'pick',
  valueIndex: 0,
  type: 'EmailV1.0',
  ...overrides,
});

const phoneRule = (overrides) => ({
  path: [['credentialSubject', 'phone']],
  rule: 'pick',
  valueIndex: 1,
  type: 'PhoneV1.0',
  ...overrides,
});

// A verified credential with the type computed from it.
const verified = (type, credentialSubject) => ({
  type,
  credential: { credentialSubject },
});
const emailCredential = (email) => verified('EmailV1.0', { email });
const phoneCredential = (phone) => verified('PhoneV1.0', { phone });

describe('vp auth rules', () => {
  describe('buildCandidateTuples', () => {
    it('should build a tuple of one normalized value for one rule', () => {
      expect(
        buildCandidateTuples(
          [emailRule()],
          [emailCredential(' Adam@Example.com ')],
        ),
      ).toEqual([['adam@example.com']]);
    });

    it('should keep every distinct value of a pick rule', () => {
      expect(
        buildCandidateTuples(
          [emailRule()],
          [
            emailCredential('a@x.com'),
            emailCredential('b@x.com'),
            emailCredential('A@x.com'),
          ],
        ),
      ).toEqual([['a@x.com'], ['b@x.com']]);
    });

    it('should keep the value of an equal rule only when there is exactly one', () => {
      const rules = [emailRule({ rule: 'equal' })];
      expect(
        buildCandidateTuples(rules, [
          emailCredential('a@x.com'),
          emailCredential(' A@X.com'),
        ]),
      ).toEqual([['a@x.com']]);
      expect(
        buildCandidateTuples(rules, [
          emailCredential('a@x.com'),
          emailCredential('b@x.com'),
        ]),
      ).toEqual([]);
    });

    it('should put each value at its rule valueIndex, whatever the order of the rules', () => {
      const credentials = [
        emailCredential('a@x.com'),
        phoneCredential('+1555'),
      ];
      expect(
        buildCandidateTuples([emailRule(), phoneRule()], credentials),
      ).toEqual([['a@x.com', '+1555']]);
      expect(
        buildCandidateTuples([phoneRule(), emailRule()], credentials),
      ).toEqual([['a@x.com', '+1555']]);
      expect(
        buildCandidateTuples(
          [phoneRule({ valueIndex: 0 }), emailRule({ valueIndex: 1 })],
          credentials,
        ),
      ).toEqual([['+1555', 'a@x.com']]);
    });

    it('should build every combination across rules', () => {
      expect(
        buildCandidateTuples(
          [emailRule(), phoneRule()],
          [
            emailCredential('a@x.com'),
            emailCredential('b@x.com'),
            phoneCredential('+1555'),
            phoneCredential('+1666'),
          ],
        ),
      ).toEqual([
        ['a@x.com', '+1555'],
        ['a@x.com', '+1666'],
        ['b@x.com', '+1555'],
        ['b@x.com', '+1666'],
      ]);
    });

    it('should read each rule from the credentials of its own type', () => {
      expect(
        buildCandidateTuples(
          [emailRule(), phoneRule()],
          [
            emailCredential('a@x.com'),
            verified('PhoneV1.0', { phone: '+1555', email: 'b@x.com' }),
            verified('EmailV1.0', { email: 'c@x.com', phone: '+1666' }),
          ],
        ),
      ).toEqual([
        ['a@x.com', '+1555'],
        ['c@x.com', '+1555'],
      ]);
    });

    it('should build no tuples when a rule yields nothing', () => {
      expect(
        buildCandidateTuples(
          [emailRule(), phoneRule()],
          [emailCredential('a@x.com')],
        ),
      ).toEqual([]);
      expect(
        buildCandidateTuples(
          [emailRule(), phoneRule({ rule: 'equal' })],
          [
            emailCredential('a@x.com'),
            phoneCredential('+1555'),
            phoneCredential('+1666'),
          ],
        ),
      ).toEqual([]);
    });

    it('should build no tuples without rules or with an unknown rule', () => {
      expect(buildCandidateTuples([], [emailCredential('a@x.com')])).toEqual(
        [],
      );
      expect(
        buildCandidateTuples(
          [emailRule({ rule: 'constructor' })],
          [emailCredential('a@x.com')],
        ),
      ).toEqual([]);
    });

    it('should allow up to 100 combinations', () => {
      const emails = times((i) => `user${i}@x.com`, 10);
      const phones = times((i) => `+1555000${i}`, 10);

      const tuples = buildCandidateTuples(
        [emailRule(), phoneRule()],
        [...map(emailCredential, emails), ...map(phoneCredential, phones)],
      );

      expect(tuples).toHaveLength(100);
    });

    it('should 400 presentation_invalid for more than 100 combinations', () => {
      const emails = times((i) => `user${i}@x.com`, 11);
      const phones = times((i) => `+1555000${i}`, 11);

      expect(() =>
        buildCandidateTuples(
          [emailRule(), phoneRule()],
          [...map(emailCredential, emails), ...map(phoneCredential, phones)],
        ),
      ).toThrow(
        expect.objectContaining({
          statusCode: 400,
          errorCode: 'presentation_invalid',
        }),
      );
    });

    describe('with many rules', () => {
      const credentials = map(
        emailCredential,
        times((i) => `user${i}@x.com`, 100),
      );
      // Rules at value indexes 0 to count-1, each finding the 100 emails
      const emailRules = (count) =>
        times((valueIndex) => emailRule({ valueIndex }), count);

      it('should build no tuples when an empty position follows many large ones', () => {
        const rules = [
          ...emailRules(155),
          emailRule({
            valueIndex: 155,
            path: [['credentialSubject', 'missing']],
          }),
        ];

        expect(buildCandidateTuples(rules, credentials)).toEqual([]);
      });

      it('should 400 presentation_invalid for many large positions', () => {
        expect(() =>
          buildCandidateTuples(emailRules(156), credentials),
        ).toThrow(
          expect.objectContaining({
            statusCode: 400,
            errorCode: 'presentation_invalid',
          }),
        );
      });
    });
  });
});
