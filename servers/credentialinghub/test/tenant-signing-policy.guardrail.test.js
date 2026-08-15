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
 */

const { describe, it } = require('node:test');
const { expect } = require('expect');
const {
  CredentialSigningAlgorithms,
  getCredentialSigningAlgorithmsSupported,
  resolveCredentialSigningAlgorithm,
} = require('../src/entities/tenants');
const expectedAlgorithms = ['SECP256K1', 'ES256', 'RS256'];

describe('tenant credential signing policy guardrails', () => {
  it('exposes the exact key algorithm allowlist', () => {
    expect(CredentialSigningAlgorithms).toEqual(expectedAlgorithms);
  });

  expectedAlgorithms.forEach((credentialSigningAlgorithm) => {
    it(`gives the tenant ${credentialSigningAlgorithm} override precedence over every credential-type default`, () => {
      expect(
        ['SECP256K1', 'ES256', 'RS256', undefined].map(
          (defaultSignatureAlgorithm) =>
            resolveCredentialSigningAlgorithm({
              tenant: { credentialSigningAlgorithm },
              credentialTypeMetadata: { defaultSignatureAlgorithm },
            }),
        ),
      ).toEqual(Array(4).fill(credentialSigningAlgorithm));
    });
  });

  expectedAlgorithms.forEach((defaultSignatureAlgorithm) => {
    it(`preserves the credential-type ${defaultSignatureAlgorithm} default when the tenant has no override`, () => {
      expect(
        resolveCredentialSigningAlgorithm({
          tenant: {},
          credentialTypeMetadata: { defaultSignatureAlgorithm },
        }),
      ).toEqual(defaultSignatureAlgorithm);
    });
  });

  it('preserves the Open Badge RS256 default without a badge-specific branch', () => {
    expect(
      resolveCredentialSigningAlgorithm({
        tenant: {},
        credentialTypeMetadata: {
          credentialType: 'OpenBadgeCredential',
          defaultSignatureAlgorithm: 'RS256',
        },
      }),
    ).toEqual('RS256');
  });

  it('preserves the existing SECP256K1 credential-type default', () => {
    expect(
      resolveCredentialSigningAlgorithm({
        tenant: {},
        credentialTypeMetadata: {
          defaultSignatureAlgorithm: 'SECP256K1',
        },
      }),
    ).toEqual('SECP256K1');
  });

  it('advertises every internal algorithm with the type default first when there is no tenant override', () => {
    expect(
      getCredentialSigningAlgorithmsSupported({
        tenant: {},
        credentialTypeMetadata: { defaultSignatureAlgorithm: 'RS256' },
      }),
    ).toEqual(['RS256', 'SECP256K1', 'ES256']);
  });

  it('advertises only the internal algorithm selected by a tenant override', () => {
    expect(
      getCredentialSigningAlgorithmsSupported({
        tenant: { credentialSigningAlgorithm: 'ES256' },
        credentialTypeMetadata: { defaultSignatureAlgorithm: 'RS256' },
      }),
    ).toEqual(['ES256']);
  });

  [undefined, null].forEach((credentialSigningAlgorithm) => {
    it(`falls back to SECP256K1 when the tenant override is ${credentialSigningAlgorithm} and the type has no default`, () => {
      expect(
        resolveCredentialSigningAlgorithm({
          tenant: { credentialSigningAlgorithm },
          credentialTypeMetadata: {},
        }),
      ).toEqual('SECP256K1');
    });
  });
});
