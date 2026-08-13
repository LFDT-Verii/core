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

const loadValidators = () => require('../src/v2-credential-model-validator');

const coreCredential = Object.freeze({
  '@context': Object.freeze([
    'https://www.w3.org/ns/credentials/v2',
    Object.freeze({
      EmploymentCredential: 'https://example.com/EmploymentCredential',
    }),
  ]),
  credentialSubject: Object.freeze({ id: 'did:example:holder' }),
  issuer: Object.freeze({ id: 'did:example:issuer' }),
  type: Object.freeze(['VerifiableCredential', 'EmploymentCredential']),
});

const profileCredential = Object.freeze({
  ...coreCredential,
  id: 'did:example:credential',
  validFrom: '2026-01-01T00:00:00Z',
});

describe('VC 2.0 credential model validator guardrails', () => {
  it('keeps W3C core and Velocity profile requirements separate', () => {
    const { isV2CoreCredential, isVelocityV2Credential } = loadValidators();

    expect(isV2CoreCredential(coreCredential)).toBe(true);
    expect(isVelocityV2Credential(coreCredential)).toBe(false);
    expect(isVelocityV2Credential(profileCredential)).toBe(true);
  });

  it('accepts permitted registered JWT claims and rejects only vc and vp', () => {
    const { isV2CoreCredential } = loadValidators();
    const registeredClaims = {
      ...coreCredential,
      aud: ['https://verifier.example'],
      exp: 4070908800,
      iat: 1767225600,
      iss: 'did:example:issuer',
      jti: 'https://example.com/credentials/123',
      nbf: 1767225600,
      sub: 'did:example:holder',
    };

    expect(isV2CoreCredential(registeredClaims)).toBe(true);
    expect(isV2CoreCredential({ ...registeredClaims, vc: {} })).toBe(false);
    expect(isV2CoreCredential({ ...registeredClaims, vp: {} })).toBe(false);
  });

  for (const [name, issuer] of [
    ['a missing issuer', undefined],
    ['an empty issuer id', ''],
    ['a missing object issuer id', {}],
    ['an empty object issuer id', { id: '' }],
  ]) {
    it(`rejects ${name}`, () => {
      const { isV2CoreCredential } = loadValidators();

      expect(isV2CoreCredential({ ...coreCredential, issuer })).toBe(false);
    });
  }

  for (const [name, credentialSubject] of [
    ['an empty subject list', []],
    ['a subject list with null', [null]],
    ['a subject list with a primitive', ['did:example:holder']],
  ]) {
    it(`rejects ${name}`, () => {
      const { isV2CoreCredential } = loadValidators();

      expect(isV2CoreCredential({ ...coreCredential, credentialSubject })).toBe(
        false,
      );
    });
  }

  for (const [name, credentialSchema] of [
    ['an empty schema list', []],
    ['a schema without an id', { type: 'JsonSchema' }],
    [
      'a schema with a malformed id URL',
      { id: 'not a uri', type: 'JsonSchema' },
    ],
    ['a schema without a type', { id: 'https://example.com/schema.json' }],
  ]) {
    it(`rejects ${name}`, () => {
      const { isV2CoreCredential } = loadValidators();

      expect(isV2CoreCredential({ ...coreCredential, credentialSchema })).toBe(
        false,
      );
    });
  }

  for (const [name, validFrom] of [
    ['a non-date value', 'yesterday'],
    ['an impossible calendar date', '2026-02-30T00:00:00Z'],
    ['an out-of-range timezone', '2026-01-01T00:00:00+24:00'],
  ]) {
    it(`rejects ${name}`, () => {
      const { isVelocityV2Credential } = loadValidators();

      expect(isVelocityV2Credential({ ...profileCredential, validFrom })).toBe(
        false,
      );
    });
  }

  it('does not mutate data while applying schemas', () => {
    const { isV2CoreCredential, isVelocityV2Credential } = loadValidators();
    const input = structuredClone(profileCredential);
    const beforeValidation = structuredClone(input);

    expect(isV2CoreCredential(input)).toBe(true);
    expect(isVelocityV2Credential(input)).toBe(true);
    expect(input).toEqual(beforeValidation);
  });

  it('requires the base context first and forbids duplicate contexts', () => {
    const { isV2CoreCredential, isVelocityV2Credential } = loadValidators();
    const wrongFirst = {
      ...profileCredential,
      '@context': [
        'https://example.com/credentials/context',
        'https://www.w3.org/ns/credentials/v2',
      ],
    };
    const duplicate = {
      ...profileCredential,
      '@context': [
        'https://www.w3.org/ns/credentials/v2',
        'https://www.w3.org/ns/credentials/v2',
      ],
    };

    expect(isV2CoreCredential(wrongFirst)).toBe(false);
    expect(isVelocityV2Credential(wrongFirst)).toBe(false);
    expect(isV2CoreCredential(duplicate)).toBe(false);
    expect(isVelocityV2Credential(duplicate)).toBe(false);
  });
});
