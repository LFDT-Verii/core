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

const { afterEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');
const { buildCredentialInput, buildVcV2Credential } = require('../src');
const {
  buildJsonLdCredential,
} = require('../src/domain/build-jsonld-credential');

const NOW = '2026-01-02T03:04:05.000Z';
const context = Object.freeze({
  config: Object.freeze({
    credentialExtensionsContextUrl:
      'https://example.com/contexts/velocity-extensions.jsonld',
    credentialSubjectContext: false,
  }),
});
const credentialTypeMetadata = Object.freeze({
  jsonldContext: Object.freeze([
    'https://example.com/contexts/employment-v2.jsonld',
  ]),
  schemaUrl: 'https://example.com/schema.json',
});
const issuer = Object.freeze({
  did: 'did:example:issuer',
  issuingRefreshServiceId: '#refresh-1',
});
const offer = Object.freeze({
  type: Object.freeze(['EmploymentCredential', 'VerifiableCredential']),
  issuer: Object.freeze({ id: 'ignored', name: 'Example Issuer' }),
  credentialSubject: Object.freeze({
    role: 'Engineer',
    vendorUserId: 'vendor-user',
  }),
  expirationDate: '2027-01-02T03:04:05.000Z',
});

const expectedV1Credential = Object.freeze({
  type: offer.type,
  issuer: offer.issuer,
  credentialSubject: Object.freeze({
    role: 'Engineer',
    id: 'did:example:holder',
  }),
  expirationDate: offer.expirationDate,
  '@context': Object.freeze([
    'https://www.w3.org/2018/credentials/v1',
    'https://example.com/contexts/employment-v2.jsonld',
    'https://example.com/contexts/velocity-extensions.jsonld',
  ]),
  id: 'did:velocity:v2:credential-123',
  issuanceDate: NOW,
  credentialSchema: Object.freeze({
    type: 'JsonSchemaValidator2018',
    id: credentialTypeMetadata.schemaUrl,
  }),
  credentialStatus: Object.freeze({
    type: 'VelocityRevocationListJan2021',
    id: 'https://example.com/status/1',
  }),
  contentHash: Object.freeze({
    type: 'VelocityContentHash2020',
    value: 'abc123',
  }),
  vnfProtocolVersion: 2,
  refreshService: Object.freeze({
    type: 'VelocityNetworkRefreshService2024',
    id: 'did:example:issuer#refresh-1',
  }),
});

afterEach(() => mock.timers.reset());

describe('credential document builder guardrails', () => {
  it('freezes the v1 document bytes and legacy property names', () => {
    mock.timers.enable({ apis: ['Date'], now: new Date(NOW) });

    const credential = buildJsonLdCredential(
      issuer,
      'did:example:holder',
      offer,
      'did:velocity:v2:credential-123',
      'abc123',
      credentialTypeMetadata,
      'https://example.com/status/1',
      context,
    );

    expect(JSON.stringify(credential)).toBe(
      JSON.stringify(expectedV1Credential),
    );
  });

  it('builds a conforming direct VC 2.0 document from canonical input', () => {
    mock.timers.enable({ apis: ['Date'], now: new Date(NOW) });

    const credentialInput = buildCredentialInput({
      contentHash: 'abc123',
      context,
      credentialId: 'did:velocity:v2:credential-123',
      credentialSubjectId: 'did:example:holder',
      credentialTypeMetadata,
      issuer,
      offer,
      revocationUrl: 'https://example.com/status/1',
    });
    const credential = buildVcV2Credential(credentialInput);

    expect(credential).toEqual({
      '@context': [
        'https://www.w3.org/ns/credentials/v2',
        'https://example.com/contexts/employment-v2.jsonld',
        'https://example.com/contexts/velocity-extensions.jsonld',
      ],
      contentHash: {
        type: 'VelocityContentHash2020',
        value: 'abc123',
      },
      credentialSchema: {
        id: 'https://example.com/schema.json',
        type: 'JsonSchemaValidator2018',
      },
      credentialStatus: {
        id: 'https://example.com/status/1',
        type: 'VelocityRevocationListJan2021',
      },
      credentialSubject: {
        id: 'did:example:holder',
        role: 'Engineer',
      },
      id: 'did:velocity:v2:credential-123',
      issuer: {
        id: 'did:example:issuer',
        name: 'Example Issuer',
      },
      refreshService: {
        id: 'did:example:issuer#refresh-1',
        type: 'VelocityNetworkRefreshService2024',
      },
      type: ['VerifiableCredential', 'EmploymentCredential'],
      validFrom: NOW,
      validUntil: '2027-01-02T03:04:05.000Z',
      vnfProtocolVersion: 2,
    });
    expect(credential).not.toEqual(
      expect.objectContaining({
        expirationDate: expect.anything(),
        issuanceDate: expect.anything(),
        proof: expect.anything(),
      }),
    );
  });
});
