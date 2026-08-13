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

  it('creates version-neutral canonical input without mutating the offer', () => {
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

    const credentialInput = buildInput({ offer: mutableOffer });

    expect(credentialInput).toEqual({
      claims: { role: 'Engineer' },
      contentHash: 'abc123',
      contexts: [
        'https://example.com/contexts/employment-v2.jsonld',
        'https://example.com/contexts/velocity-extensions.jsonld',
      ],
      extensionContext:
        'https://example.com/contexts/velocity-extensions.jsonld',
      holder: 'did:example:holder',
      id: 'did:velocity:v2:credential-123',
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
      schema: {
        id: 'https://example.com/schema.json',
        type: 'JsonSchemaValidator2018',
      },
      status: [
        {
          id: 'https://example.com/custom-status',
          type: 'ExampleCredentialStatus',
        },
        {
          id: 'https://example.com/status/1',
          type: 'VelocityRevocationListJan2021',
        },
      ],
      types: ['EmploymentCredential', 'VerifiableCredential'],
      validity: {
        from: NOW,
        until: '2027-01-02T03:04:05.000Z',
      },
      vnfProtocol: { version: 2 },
    });
    expect(credentialInput).not.toEqual(
      expect.objectContaining({
        credentialSubject: expect.anything(),
        expirationDate: expect.anything(),
        issuanceDate: expect.anything(),
        validFrom: expect.anything(),
        validUntil: expect.anything(),
        vnfProtocolVersion: expect.anything(),
      }),
    );
    expect(mutableOffer).toEqual(originalOffer);
  });

  it('omits optional validUntil and holder id when they are absent', () => {
    mock.timers.enable({ apis: ['Date'], now: new Date(NOW) });
    const input = buildInput({
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
    const input = buildInput({
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
    const input = buildInput({
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
      expect(() => buildInput(values)).toThrow(error);
    });
  }

  it('rejects a malformed validity value in the built document', () => {
    const input = buildInput({
      offer: { ...offer, validFrom: 'not-a-date' },
    });

    expect(() => buildVcV2Credential(input)).toThrow(
      'violates the date-time profile: validFrom',
    );
  });

  it('rejects a validity interval whose end precedes its start', () => {
    const input = buildInput({
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
    const input = buildInput({
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

  for (const [name, override] of [
    ['an empty status array', { status: [] }],
    [
      'a status without a type',
      { status: { id: 'https://example.com/status/1' } },
    ],
    ['an empty refresh-service array', { refreshService: [] }],
    ['an empty refresh-service object', { refreshService: {} }],
    ['a scalar refresh service', { refreshService: 'invalid' }],
    ['an empty content hash', { contentHash: '' }],
    ['an unsupported protocol version', { vnfProtocol: { version: 3 } }],
  ]) {
    it(`rejects ${name} in the emitted credential`, () => {
      expect(() =>
        buildVcV2Credential({
          ...buildInput(),
          ...override,
        }),
      ).toThrow('violates the Velocity profile');
    });
  }

  it('rejects canonical input without the pinned extension context', () => {
    const input = buildInput();

    expect(() =>
      buildVcV2Credential({
        ...input,
        contexts: input.contexts.filter(
          (value) => value !== input.extensionContext,
        ),
      }),
    ).toThrow('requires the pinned Velocity extension context');
  });

  it('rejects malformed canonical input', () => {
    expect(() => buildVcV2Credential({})).toThrow(
      'requires canonical credential input',
    );
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
    it(`rejects canonical input without ${name}`, () => {
      expect(() => buildInput(values)).toThrow('Canonical credential input');
    });
  }
});

const buildInput = (overrides = {}) =>
  buildCredentialInput({
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
