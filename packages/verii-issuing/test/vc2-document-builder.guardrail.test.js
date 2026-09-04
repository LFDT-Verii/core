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
const { buildVcV2Credential } = require('../src');
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

  it('builds a conforming direct VC 2.0 document from issuance input', () => {
    mock.timers.enable({ apis: ['Date'], now: new Date(NOW) });

    const credential = buildVcV2Credential(buildOptions());

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

  it('builds linked data without mutating the offer', () => {
    mock.timers.enable({ apis: ['Date'], now: new Date(NOW) });
    const mutableOffer = structuredClone({
      ...offer,
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://example.com/contexts/employment-v2.jsonld',
      ],
      credentialStatus: [
        {
          id: 'https://example.com/custom-status',
          type: 'ExampleCredentialStatus',
        },
      ],
      refreshService: [
        {
          id: 'https://example.com/custom-refresh',
          type: 'ExampleRefreshService',
        },
      ],
    });
    const originalOffer = structuredClone(mutableOffer);

    const credential = buildVcV2Credential(
      buildOptions({ offer: mutableOffer }),
    );

    expect(credential).toEqual(
      expect.objectContaining({
        credentialStatus: [
          {
            id: 'https://example.com/custom-status',
            type: 'ExampleCredentialStatus',
          },
          {
            id: 'https://example.com/status/1',
            type: 'VelocityRevocationListJan2021',
          },
        ],
        credentialSubject: {
          id: 'did:example:holder',
          role: 'Engineer',
        },
        issuer: { id: 'did:example:issuer', name: 'Example Issuer' },
        refreshService: [
          {
            id: 'https://example.com/custom-refresh',
            type: 'ExampleRefreshService',
          },
          {
            id: 'did:example:issuer#refresh-1',
            type: 'VelocityNetworkRefreshService2024',
          },
        ],
      }),
    );
    expect(mutableOffer).toEqual(originalOffer);
  });

  it('prevents offer claims from overriding the authoritative holder', () => {
    const credential = buildVcV2Credential(
      buildOptions({
        credentialSubjectId: 'did:example:authoritative-holder',
        offer: {
          ...offer,
          credentialSubject: {
            id: 'did:example:attacker-controlled-holder',
            role: 'Engineer',
          },
        },
      }),
    );

    expect(credential.credentialSubject).toEqual({
      id: 'did:example:authoritative-holder',
      role: 'Engineer',
    });
  });

  it('preserves custom linked data alongside Velocity profile values', () => {
    const credential = buildVcV2Credential(
      buildOptions({
        offer: {
          ...offer,
          credentialStatus: {
            id: 'https://example.com/custom-status',
            type: 'ExampleCredentialStatus',
          },
          refreshService: {
            id: 'https://example.com/custom-refresh',
            type: 'ExampleRefreshService',
          },
        },
      }),
    );

    expect(credential).toEqual(
      expect.objectContaining({
        refreshService: [
          {
            id: 'https://example.com/custom-refresh',
            type: 'ExampleRefreshService',
          },
          {
            id: 'did:example:issuer#refresh-1',
            type: 'VelocityNetworkRefreshService2024',
          },
        ],
        credentialStatus: [
          {
            id: 'https://example.com/custom-status',
            type: 'ExampleCredentialStatus',
          },
          {
            id: 'https://example.com/status/1',
            type: 'VelocityRevocationListJan2021',
          },
        ],
      }),
    );
  });

  it('omits optional validUntil and holder id when they are absent', () => {
    mock.timers.enable({ apis: ['Date'], now: new Date(NOW) });
    const input = buildOptions({
      credentialSubjectId: undefined,
      offer: {
        ...offer,
        credentialSubject: { role: 'Engineer' },
        expirationDate: undefined,
      },
    });

    expect(buildVcV2Credential(input)).toEqual(
      expect.objectContaining({
        credentialSubject: { role: 'Engineer' },
        validFrom: NOW,
        vnfProtocolVersion: 1,
      }),
    );
    expect(buildVcV2Credential(input)).not.toHaveProperty('validUntil');
  });

  it('uses an explicit neutral validity interval', () => {
    const input = buildOptions({
      offer: {
        ...offer,
        validFrom: '2026-02-01T00:00:00.000Z',
        validUntil: '2026-12-01T00:00:00.000Z',
      },
    });

    expect(buildVcV2Credential(input)).toEqual(
      expect.objectContaining({
        validFrom: '2026-02-01T00:00:00.000Z',
        validUntil: '2026-12-01T00:00:00.000Z',
      }),
    );
  });

  it('removes either W3C core context from configured extension contexts', () => {
    const input = buildOptions({
      credentialTypeMetadata: {
        ...credentialTypeMetadata,
        jsonldContext: [
          'https://www.w3.org/2018/credentials/v1',
          'https://www.w3.org/ns/credentials/v2',
          ...credentialTypeMetadata.jsonldContext,
        ],
      },
    });

    expect(buildVcV2Credential(input)['@context']).toEqual([
      'https://www.w3.org/ns/credentials/v2',
      'https://example.com/contexts/employment-v2.jsonld',
      'https://example.com/contexts/velocity-extensions.jsonld',
    ]);
  });

  for (const [name, values, error] of [
    [
      'an offer-controlled context',
      {
        offer: {
          ...offer,
          '@context': 'https://attacker.example/context.jsonld',
        },
      },
      'context is not allowlisted',
    ],
    [
      'an inline context',
      { offer: { ...offer, '@context': { unsafe: 'https://example.com' } } },
      'context is not allowlisted',
    ],
    [
      'a non-HTTPS configured context',
      {
        credentialTypeMetadata: {
          ...credentialTypeMetadata,
          jsonldContext: ['http://example.com/context.jsonld'],
        },
      },
      'context must use HTTPS',
    ],
    [
      'a malformed configured context URL',
      {
        credentialTypeMetadata: {
          ...credentialTypeMetadata,
          jsonldContext: ['not a URL'],
        },
      },
      'credential context is invalid',
    ],
    [
      'a missing extension context',
      {
        context: {
          config: { credentialExtensionsContextUrl: undefined },
        },
      },
      'contexts must be pinned URLs',
    ],
  ]) {
    it(`rejects ${name}`, () => {
      expect(() => buildVcV2Credential(buildOptions(values))).toThrow(error);
    });
  }

  it('rejects a malformed validity value in the built document', () => {
    const input = buildOptions({
      offer: { ...offer, validFrom: 'not-a-date' },
    });

    expect(() => buildVcV2Credential(input)).toThrow(
      'violates the date-time profile: validFrom',
    );
  });

  it('rejects a validity interval whose end precedes its start', () => {
    const input = buildOptions({
      offer: {
        ...offer,
        validFrom: '2027-01-02T03:04:05.000Z',
        validUntil: '2026-01-02T03:04:05.000Z',
      },
    });

    expect(() => buildVcV2Credential(input)).toThrow(
      'validity end must not precede its start',
    );
  });

  it('preserves an offered refresh service when the issuer has no default', () => {
    const input = buildOptions({
      issuer: { ...issuer, issuingRefreshServiceId: undefined },
      offer: {
        ...offer,
        refreshService: {
          id: 'https://example.com/custom-refresh',
          type: 'ExampleRefreshService',
        },
      },
    });

    expect(buildVcV2Credential(input).refreshService).toEqual({
      id: 'https://example.com/custom-refresh',
      type: 'ExampleRefreshService',
    });
  });

  for (const [name, values] of [
    [
      'a status without a type',
      {
        offer: {
          ...offer,
          credentialStatus: { id: 'https://example.com/custom-status' },
        },
      },
    ],
    [
      'an empty refresh-service array',
      {
        issuer: { ...issuer, issuingRefreshServiceId: undefined },
        offer: { ...offer, refreshService: [] },
      },
    ],
    [
      'an empty refresh-service object',
      {
        issuer: { ...issuer, issuingRefreshServiceId: undefined },
        offer: { ...offer, refreshService: {} },
      },
    ],
    [
      'a scalar refresh service',
      {
        issuer: { ...issuer, issuingRefreshServiceId: undefined },
        offer: { ...offer, refreshService: 'invalid' },
      },
    ],
  ]) {
    it(`rejects ${name} in the emitted credential`, () => {
      expect(() => buildVcV2Credential(buildOptions(values))).toThrow(
        'violates the Velocity profile',
      );
    });
  }

  it('rejects malformed build options', () => {
    expect(() => buildVcV2Credential({})).toThrow('requires contentHash');
  });

  for (const [name, values] of [
    ['contentHash', { contentHash: '' }],
    ['credentialId', { credentialId: '' }],
    ['issuer.did', { issuer: {} }],
    ['revocationUrl', { revocationUrl: '' }],
    ['credential subject', { offer: { ...offer, credentialSubject: null } }],
    ['credential metadata', { credentialTypeMetadata: null }],
    ['context config', { context: null }],
  ]) {
    it(`rejects build options without ${name}`, () => {
      expect(() => buildVcV2Credential(buildOptions(values))).toThrow(
        'VC 2.0 builder requires',
      );
    });
  }
});

const buildOptions = (overrides = {}) => ({
  contentHash: 'abc123',
  context,
  credentialId: 'did:velocity:v2:credential-123',
  credentialSubjectId: 'did:example:holder',
  credentialTypeMetadata,
  issuer,
  offer,
  revocationUrl: 'https://example.com/status/1',
  ...overrides,
});
