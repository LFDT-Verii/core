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
const {
  buildAuthRulesFingerprint,
} = require('../../src/entities/depots/domain/auth-rules-fingerprint');

const emailRule = {
  path: [['credentialSubject', 'email']],
  rule: 'pick',
  valueIndex: 0,
  type: 'EmailV1.0',
};
const employeeIdRule = {
  path: [
    ['credentialSubject', 'employeeId'],
    ['credentialSubject', 'id'],
  ],
  rule: 'equal',
  valueIndex: 1,
  type: 'EmploymentPastV1.1',
};

const buildService = (overrides = {}) => ({
  authMethods: ['verifiable_presentation'],
  authMode: 'internal',
  verifiablePresentationAuthRules: [emailRule, employeeIdRule],
  disclosureRequest: {
    types: [{ type: 'EmailV1.0' }, { type: 'EmploymentPastV1.1' }],
    purpose: 'Identification',
  },
  ...overrides,
});

describe('buildAuthRulesFingerprint', () => {
  const fingerprint = buildAuthRulesFingerprint(buildService());

  it('should hash the auth configuration of an internal VP service', () => {
    expect(fingerprint).toEqual(expect.any(String));
    expect(fingerprint).not.toEqual('');
  });

  it('should be the same when the rules are listed in another order', () => {
    expect(
      buildAuthRulesFingerprint(
        buildService({
          verifiablePresentationAuthRules: [employeeIdRule, emailRule],
        }),
      ),
    ).toEqual(fingerprint);
  });

  it('should be the same when the requested types are listed in another order', () => {
    expect(
      buildAuthRulesFingerprint(
        buildService({
          disclosureRequest: {
            types: [{ type: 'EmploymentPastV1.1' }, { type: 'EmailV1.0' }],
          },
        }),
      ),
    ).toEqual(fingerprint);
  });

  it('should ignore fields outside the rules and the requested types', () => {
    expect(
      buildAuthRulesFingerprint(
        buildService({
          description: 'updated',
          termsUrl: 'https://www.example.com/updated',
          disclosureRequest: {
            types: [{ type: 'EmailV1.0' }, { type: 'EmploymentPastV1.1' }],
            purpose: 'Updated purpose',
          },
        }),
      ),
    ).toEqual(fingerprint);
  });

  it('should be the same for a service with both auth methods', () => {
    expect(
      buildAuthRulesFingerprint(
        buildService({ authMethods: ['preauth', 'verifiable_presentation'] }),
      ),
    ).toEqual(fingerprint);
  });

  const changes = {
    'swapped value indexes': {
      verifiablePresentationAuthRules: [
        { ...emailRule, valueIndex: 1 },
        { ...employeeIdRule, valueIndex: 0 },
      ],
    },
    'a changed path': {
      verifiablePresentationAuthRules: [
        { ...emailRule, path: [['credentialSubject', 'emailAddress']] },
        employeeIdRule,
      ],
    },
    'reordered paths': {
      verifiablePresentationAuthRules: [
        emailRule,
        { ...employeeIdRule, path: [...employeeIdRule.path].reverse() },
      ],
    },
    'a changed rule': {
      verifiablePresentationAuthRules: [
        { ...emailRule, rule: 'equal' },
        employeeIdRule,
      ],
    },
    'a changed rule type': {
      verifiablePresentationAuthRules: [
        { ...emailRule, type: 'EmploymentPastV1.1' },
        employeeIdRule,
      ],
    },
    'an added rule': {
      verifiablePresentationAuthRules: [
        emailRule,
        employeeIdRule,
        {
          path: [['credentialSubject', 'phone']],
          rule: 'pick',
          valueIndex: 2,
          type: 'EmailV1.0',
        },
      ],
    },
    'a removed rule': { verifiablePresentationAuthRules: [emailRule] },
    'changed requested types': {
      disclosureRequest: { types: [{ type: 'EmailV1.0' }] },
    },
  };
  for (const [name, overrides] of Object.entries(changes)) {
    it(`should change with ${name}`, () => {
      expect(buildAuthRulesFingerprint(buildService(overrides))).not.toEqual(
        fingerprint,
      );
    });
  }

  it('should be null for a preauth-only service', () => {
    expect(
      buildAuthRulesFingerprint(buildService({ authMethods: ['preauth'] })),
    ).toBeNull();
  });

  it('should be null for a VP service without internal auth', () => {
    expect(
      buildAuthRulesFingerprint(buildService({ authMode: undefined })),
    ).toBeNull();
  });
});
