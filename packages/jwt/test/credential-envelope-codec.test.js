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
  buildDecodedCredential,
  buildDecodedPresentation,
  CredentialContexts,
  CredentialDataModelVersions,
  CredentialEnvelopeError,
  CredentialEnvelopeErrorCodes,
  CredentialEnvelopeFormats,
  CredentialEnvelopeLimits,
  decodeCredentialEnvelope,
  getCredentialId,
  getCredentialIssuer,
  getCredentialSchema,
  getCredentialStatus,
  getCredentialSubject,
  getCredentialTypes,
  getCredentialValidity,
} = require('..');
const {
  buildDecodedCredential: buildLegacyCredential,
  buildDecodedPresentation: buildLegacyPresentation,
} = require('../src/credential-envelope-legacy');
const verifiableDecoderExports = require('../src/verifiable-decoders');
const {
  compactCredentialFixture,
  expectedLegacyCredential,
  legacyCredentialFixtures,
  legacyPayload,
  VC_V1_CONTEXT,
  VC_V2_CONTEXT,
  v2Credential,
  v2CredentialFixture,
} = require('./fixtures/credential-envelope-fixtures');

const deeplyNested = (depth) => {
  let value = 'leaf';
  for (let index = 0; index < depth; index += 1) {
    value = { nested: value };
  }
  return value;
};

const expectEnvelopeError = (operation, code) => {
  try {
    operation();
    throw new Error(`Expected credential envelope error ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(CredentialEnvelopeError);
    expect(error).toMatchObject({ code, name: 'CredentialEnvelopeError' });
  }
};

const jsonSegment = (value) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

const maximumEncodedLength = (maximumBytes) => Math.ceil(maximumBytes / 3) * 4;

describe('credential envelope classification', () => {
  it('classifies a direct VC 2.0 payload', () => {
    expect(decodeCredentialEnvelope(v2CredentialFixture)).toEqual({
      compact: v2CredentialFixture,
      credential: v2Credential,
      dataModelVersion: '2.0',
      envelopeFormat: 'vc+jwt',
      protectedHeader: {
        alg: 'ES256',
        cty: 'vc',
        kid: 'did:velocity:v2:credential-123#key-1',
        typ: 'vc+jwt',
      },
    });
  });

  it('classifies a historical VC 1.1 envelope', () => {
    expect(
      decodeCredentialEnvelope(legacyCredentialFixtures[0].compact),
    ).toEqual({
      compact: legacyCredentialFixtures[0].compact,
      credential: expectedLegacyCredential,
      dataModelVersion: '1.1',
      envelopeFormat: 'jwt_vc_json-ld',
      protectedHeader: legacyCredentialFixtures[0].header,
    });
  });

  it('classifies a legacy VC 1.1 envelope without a nested context', () => {
    const payload = {
      iss: 'did:ion:1234567890',
      vc: {
        id: 'did:velocity:v2:1:BBB:42',
        type: ['CredentialMetadataListHeader'],
        credentialSubject: {
          accountId: 'BBB',
          listId: 1,
        },
      },
    };
    const compact = compactCredentialFixture(
      { alg: 'ES256K', typ: 'JWT' },
      payload,
    );

    expect(decodeCredentialEnvelope(compact)).toMatchObject({
      compact,
      credential: {
        issuer: { id: payload.iss },
        credentialSubject: payload.vc.credentialSubject,
        type: payload.vc.type,
      },
      dataModelVersion: CredentialDataModelVersions.V1_1,
      envelopeFormat: CredentialEnvelopeFormats.JWT_VC_JSON_LD,
      protectedHeader: { alg: 'ES256K', typ: 'JWT' },
    });
  });

  it('rejects a VC 2.0 document nested in the legacy vc claim', () => {
    const compact = compactCredentialFixture(
      { alg: 'ES256', typ: 'vc+jwt' },
      { vc: { ...legacyPayload.vc, '@context': [VC_V2_CONTEXT] } },
    );

    expectEnvelopeError(
      () => decodeCredentialEnvelope(compact),
      CredentialEnvelopeErrorCodes.MIXED_FORMAT,
    );
  });

  it('rejects mixed direct and nested credential signals', () => {
    const compact = compactCredentialFixture(
      { alg: 'ES256', typ: 'vc+jwt' },
      { ...v2Credential, vc: legacyPayload.vc },
    );

    expectEnvelopeError(
      () => decodeCredentialEnvelope(compact),
      CredentialEnvelopeErrorCodes.MIXED_FORMAT,
    );
  });

  it('rejects mixed direct and presentation signals', () => {
    const compact = compactCredentialFixture(
      { alg: 'ES256', typ: 'vc+jwt' },
      { ...v2Credential, vp: {} },
    );

    expectEnvelopeError(
      () => decodeCredentialEnvelope(compact),
      CredentialEnvelopeErrorCodes.MIXED_FORMAT,
    );
  });

  it('rejects a legacy credential with the v2 type', () => {
    const compact = compactCredentialFixture(
      { alg: 'ES256', typ: 'vc+jwt' },
      legacyPayload,
    );

    expectEnvelopeError(
      () => decodeCredentialEnvelope(compact),
      CredentialEnvelopeErrorCodes.MIXED_FORMAT,
    );
  });

  it('rejects a presentation compatibility claim', () => {
    const compact = compactCredentialFixture(
      { alg: 'ES256K', typ: 'JWT' },
      { vp: { '@context': [VC_V1_CONTEXT] } },
    );

    expectEnvelopeError(
      () => decodeCredentialEnvelope(compact),
      CredentialEnvelopeErrorCodes.UNSUPPORTED_FORMAT,
    );
  });

  it('rejects a direct VC 1.1 document', () => {
    const compact = compactCredentialFixture(
      { alg: 'ES256K', typ: 'JWT' },
      legacyPayload.vc,
    );

    expectEnvelopeError(
      () => decodeCredentialEnvelope(compact),
      CredentialEnvelopeErrorCodes.UNSUPPORTED_FORMAT,
    );
  });

  it('rejects a direct VC 2.0 document without typ vc+jwt', () => {
    const compact = compactCredentialFixture(
      { alg: 'ES256', typ: 'JWT' },
      v2Credential,
    );

    expectEnvelopeError(
      () => decodeCredentialEnvelope(compact),
      CredentialEnvelopeErrorCodes.WRONG_TYPE,
    );
  });

  for (const { name, type } of [
    { name: 'missing', type: undefined },
    { name: 'numeric', type: 42 },
    { name: 'unrelated', type: ['ExampleCredential'] },
    { name: 'presentation', type: ['VerifiablePresentation'] },
    {
      name: 'mixed credential and presentation',
      type: ['VerifiableCredential', 'VerifiablePresentation'],
    },
    {
      name: 'a malformed array member',
      type: ['VerifiableCredential', 42],
    },
  ]) {
    it(`rejects a direct VC 2.0 document with ${name} credential type`, () => {
      const compact = compactCredentialFixture(
        { alg: 'ES256', typ: 'vc+jwt' },
        { ...v2Credential, type },
      );

      expectEnvelopeError(
        () => decodeCredentialEnvelope(compact),
        CredentialEnvelopeErrorCodes.CREDENTIAL_TYPE_INVALID,
      );
    });
  }

  it('accepts a string VerifiableCredential type', () => {
    const compact = compactCredentialFixture(
      { alg: 'ES256', typ: 'vc+jwt' },
      { ...v2Credential, type: 'VerifiableCredential' },
    );

    expect(decodeCredentialEnvelope(compact)).toMatchObject({
      dataModelVersion: CredentialDataModelVersions.V2_0,
      envelopeFormat: CredentialEnvelopeFormats.VC_JWT,
    });
  });

  for (const typ of ['VC+JWT', 'application/vc+jwt', 'Application/VC+JWT']) {
    it(`accepts the equivalent direct VC 2.0 typ ${typ}`, () => {
      const compact = compactCredentialFixture(
        { alg: 'ES256', typ },
        v2Credential,
      );

      expect(decodeCredentialEnvelope(compact)).toMatchObject({
        dataModelVersion: CredentialDataModelVersions.V2_0,
        envelopeFormat: CredentialEnvelopeFormats.VC_JWT,
        protectedHeader: { typ },
      });
    });
  }

  for (const typ of ['jwt', 'application/jwt', 'Application/JWT']) {
    it(`accepts the equivalent nested VC 1.1 typ ${typ}`, () => {
      const compact = compactCredentialFixture(
        { alg: 'ES256K', typ },
        legacyPayload,
      );

      expect(decodeCredentialEnvelope(compact)).toMatchObject({
        dataModelVersion: CredentialDataModelVersions.V1_1,
        envelopeFormat: CredentialEnvelopeFormats.JWT_VC_JSON_LD,
        protectedHeader: { typ },
      });
    });
  }

  for (const typ of [null, '', 'vp+jwt', 'vp+sd-jwt', 'application/vp+jwt']) {
    it(`rejects nested VC 1.1 with explicit nonlegacy typ ${String(typ)}`, () => {
      const compact = compactCredentialFixture(
        { alg: 'ES256K', typ },
        legacyPayload,
      );

      expectEnvelopeError(
        () => decodeCredentialEnvelope(compact),
        CredentialEnvelopeErrorCodes.WRONG_TYPE,
      );
    });
  }

  for (const { name, payload } of [
    {
      name: 'a direct unknown first context',
      payload: { ...v2Credential, '@context': ['https://example.com/unknown'] },
    },
    {
      name: 'a nested unknown first context',
      payload: {
        vc: {
          ...legacyPayload.vc,
          '@context': ['https://example.com/unknown', VC_V1_CONTEXT],
        },
      },
    },
    {
      name: 'a nested non-array context',
      payload: {
        vc: {
          ...legacyPayload.vc,
          '@context': VC_V1_CONTEXT,
        },
      },
    },
    {
      name: 'a missing context',
      payload: { id: 'did:example:credential' },
    },
    {
      name: 'a non-array context',
      payload: { ...v2Credential, '@context': VC_V2_CONTEXT },
    },
  ]) {
    it(`rejects ${name}`, () => {
      const compact = compactCredentialFixture(
        { alg: 'ES256', typ: 'JWT' },
        payload,
      );

      expectEnvelopeError(
        () => decodeCredentialEnvelope(compact),
        CredentialEnvelopeErrorCodes.UNSUPPORTED_CONTEXT,
      );
    });
  }

  it('rejects a non-object vc compatibility claim', () => {
    const compact = compactCredentialFixture(
      { alg: 'ES256K', typ: 'JWT' },
      { vc: [] },
    );

    expectEnvelopeError(
      () => decodeCredentialEnvelope(compact),
      CredentialEnvelopeErrorCodes.JSON_NOT_OBJECT,
    );
  });
});

describe('credential envelope bounded parsing', () => {
  it('rejects a non-string compact value', () => {
    expectEnvelopeError(
      () => decodeCredentialEnvelope(null),
      CredentialEnvelopeErrorCodes.COMPACT_JWS_INVALID,
    );
  });

  it('rejects a compact value over the total character bound', () => {
    expectEnvelopeError(
      () =>
        decodeCredentialEnvelope(
          'a'.repeat(CredentialEnvelopeLimits.MAX_COMPACT_CHARACTERS + 1),
        ),
      CredentialEnvelopeErrorCodes.COMPACT_JWS_INVALID,
    );
  });

  it('rejects a compact value without exactly three segments', () => {
    expectEnvelopeError(
      () => decodeCredentialEnvelope('a.b'),
      CredentialEnvelopeErrorCodes.COMPACT_JWS_INVALID,
    );
  });

  for (const { compact, name } of [
    { compact: '=.e30.c2ln', name: 'padded protected header' },
    {
      compact: `${jsonSegment({ alg: 'ES256' })}.=.c2ln`,
      name: 'padded payload',
    },
    {
      compact: `${jsonSegment({ alg: 'ES256' })}.e30.`,
      name: 'empty signature',
    },
    {
      compact: `${jsonSegment({ alg: 'ES256' })}.e30.A`,
      name: 'non-canonical signature',
    },
  ]) {
    it(`rejects a ${name}`, () => {
      expectEnvelopeError(
        () => decodeCredentialEnvelope(compact),
        CredentialEnvelopeErrorCodes.COMPACT_JWS_INVALID,
      );
    });
  }

  for (const { name, segmentIndex, size } of [
    {
      name: 'protected header',
      segmentIndex: 0,
      size: CredentialEnvelopeLimits.MAX_PROTECTED_HEADER_BYTES,
    },
    {
      name: 'payload',
      segmentIndex: 1,
      size: CredentialEnvelopeLimits.MAX_PAYLOAD_BYTES,
    },
    {
      name: 'signature',
      segmentIndex: 2,
      size: CredentialEnvelopeLimits.MAX_SIGNATURE_BYTES,
    },
  ]) {
    it(`rejects an encoded ${name} over its bound`, () => {
      const segments = [jsonSegment({ alg: 'ES256' }), 'e30', 'c2ln'];
      segments[segmentIndex] = 'A'.repeat(maximumEncodedLength(size) + 1);

      expectEnvelopeError(
        () => decodeCredentialEnvelope(segments.join('.')),
        CredentialEnvelopeErrorCodes.SEGMENT_TOO_LARGE,
      );
    });

    it(`rejects a decoded ${name} over its bound`, () => {
      const segments = [jsonSegment({ alg: 'ES256' }), 'e30', 'c2ln'];
      segments[segmentIndex] = Buffer.alloc(size + 1).toString('base64url');

      expectEnvelopeError(
        () => decodeCredentialEnvelope(segments.join('.')),
        CredentialEnvelopeErrorCodes.SEGMENT_TOO_LARGE,
      );
    });
  }

  for (const { name, segmentIndex } of [
    { name: 'protected header', segmentIndex: 0 },
    { name: 'payload', segmentIndex: 1 },
  ]) {
    it(`rejects invalid JSON in the ${name}`, () => {
      const segments = [jsonSegment({ alg: 'ES256' }), 'e30', 'c2ln'];
      segments[segmentIndex] = Buffer.from('{').toString('base64url');

      expectEnvelopeError(
        () => decodeCredentialEnvelope(segments.join('.')),
        CredentialEnvelopeErrorCodes.JSON_INVALID,
      );
    });

    it(`rejects a JSON array in the ${name}`, () => {
      const segments = [jsonSegment({ alg: 'ES256' }), 'e30', 'c2ln'];
      segments[segmentIndex] = jsonSegment([]);

      expectEnvelopeError(
        () => decodeCredentialEnvelope(segments.join('.')),
        CredentialEnvelopeErrorCodes.JSON_NOT_OBJECT,
      );
    });

    it(`rejects excessive JSON depth in the ${name}`, () => {
      const segments = [jsonSegment({ alg: 'ES256' }), 'e30', 'c2ln'];
      segments[segmentIndex] = jsonSegment(
        deeplyNested(CredentialEnvelopeLimits.MAX_JSON_DEPTH),
      );

      expectEnvelopeError(
        () => decodeCredentialEnvelope(segments.join('.')),
        CredentialEnvelopeErrorCodes.JSON_DEPTH_EXCEEDED,
      );
    });
  }

  it('rejects alg none before parsing the payload or signature', () => {
    const compact = `${jsonSegment({ alg: 'none' })}.=.`;

    expectEnvelopeError(
      () => decodeCredentialEnvelope(compact),
      CredentialEnvelopeErrorCodes.ALG_NONE,
    );
  });

  for (const alg of [undefined, '', 42]) {
    it(`rejects an invalid alg value ${String(alg)}`, () => {
      const compact = compactCredentialFixture({ alg }, v2Credential);

      expectEnvelopeError(
        () => decodeCredentialEnvelope(compact),
        CredentialEnvelopeErrorCodes.COMPACT_JWS_INVALID,
      );
    });
  }
});

describe('credential envelope public contract', () => {
  it('exports stable frozen constants', () => {
    expect(CredentialContexts).toEqual({
      V1_1: VC_V1_CONTEXT,
      V2_0: VC_V2_CONTEXT,
    });
    expect(CredentialDataModelVersions).toEqual({ V1_1: '1.1', V2_0: '2.0' });
    expect(CredentialEnvelopeFormats).toEqual({
      JWT_VC_JSON_LD: 'jwt_vc_json-ld',
      VC_JWT: 'vc+jwt',
    });
    expect(Object.isFrozen(CredentialContexts)).toBe(true);
    expect(Object.isFrozen(CredentialDataModelVersions)).toBe(true);
    expect(Object.isFrozen(CredentialEnvelopeErrorCodes)).toBe(true);
    expect(Object.isFrozen(CredentialEnvelopeFormats)).toBe(true);
    expect(Object.isFrozen(CredentialEnvelopeLimits)).toBe(true);
  });

  it('exports legacy builders from the legacy module', () => {
    expect(buildDecodedCredential).toBe(buildLegacyCredential);
    expect(buildDecodedPresentation).toBe(buildLegacyPresentation);
    expect(verifiableDecoderExports).not.toHaveProperty(
      'buildDecodedCredential',
    );
    expect(verifiableDecoderExports).not.toHaveProperty(
      'buildDecodedPresentation',
    );
  });

  it('reads neutral fields from a normalized envelope', () => {
    const decoded = decodeCredentialEnvelope(v2CredentialFixture);

    expect(getCredentialId(decoded)).toBe(v2Credential.id);
    expect(getCredentialIssuer(decoded)).toEqual(v2Credential.issuer);
    expect(getCredentialSchema(decoded)).toEqual(v2Credential.credentialSchema);
    expect(getCredentialStatus(decoded)).toEqual(v2Credential.credentialStatus);
    expect(getCredentialSubject(decoded)).toEqual(
      v2Credential.credentialSubject,
    );
    expect(getCredentialTypes(decoded)).toEqual(v2Credential.type);
    expect(getCredentialValidity(decoded)).toEqual({
      validFrom: v2Credential.validFrom,
      validUntil: v2Credential.validUntil,
    });
  });

  it('reads neutral fields and v1 validity aliases from a raw credential', () => {
    expect(getCredentialId(expectedLegacyCredential)).toBe(
      expectedLegacyCredential.id,
    );
    expect(getCredentialIssuer(expectedLegacyCredential)).toBe(
      expectedLegacyCredential.issuer,
    );
    expect(getCredentialSchema(expectedLegacyCredential)).toBe(
      expectedLegacyCredential.credentialSchema,
    );
    expect(getCredentialStatus(expectedLegacyCredential)).toBe(
      expectedLegacyCredential.credentialStatus,
    );
    expect(getCredentialSubject(expectedLegacyCredential)).toBe(
      expectedLegacyCredential.credentialSubject,
    );
    expect(getCredentialTypes(expectedLegacyCredential)).toBe(
      expectedLegacyCredential.type,
    );
    expect(getCredentialValidity(expectedLegacyCredential)).toEqual({
      validFrom: expectedLegacyCredential.issuanceDate,
      validUntil: expectedLegacyCredential.expirationDate,
    });
  });

  it('returns undefined neutral fields for a missing credential', () => {
    expect(getCredentialId()).toBeUndefined();
    expect(getCredentialIssuer()).toBeUndefined();
    expect(getCredentialSchema()).toBeUndefined();
    expect(getCredentialStatus()).toBeUndefined();
    expect(getCredentialSubject()).toBeUndefined();
    expect(getCredentialTypes()).toBeUndefined();
    expect(getCredentialValidity()).toEqual({
      validFrom: undefined,
      validUntil: undefined,
    });
  });

  it('does not confuse a raw credential extension with a decoded envelope', () => {
    const rawCredential = {
      id: 'did:example:outer',
      credential: { id: 'did:example:extension' },
    };

    expect(getCredentialId(rawCredential)).toBe('did:example:outer');
  });
});
