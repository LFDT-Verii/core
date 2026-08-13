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

const { after, beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');
const credentialEnvelopeCodec = require('../src/credential-envelope-codec');
const jwtCore = require('../src/core');

const compact = 'protected.payload.signature';
const credential = Object.freeze({
  '@context': ['https://www.w3.org/2018/credentials/v1'],
  credentialSubject: Object.freeze({ id: 'did:example:holder' }),
  issuer: 'did:example:issuer',
  type: Object.freeze(['VerifiableCredential']),
});
const envelope = Object.freeze({
  compact,
  credential,
  dataModelVersion: credentialEnvelopeCodec.CredentialDataModelVersions.V1_1,
  envelopeFormat:
    credentialEnvelopeCodec.CredentialEnvelopeFormats.JWT_VC_JSON_LD,
  protectedHeader: Object.freeze({ alg: 'ES256K', typ: 'JWT' }),
});
const verificationKey = Object.freeze({ crv: 'secp256k1', kty: 'EC' });
const decodeCredentialEnvelope = mock.fn(() => envelope);
const jwsVerify = mock.fn(async () => undefined);
const jwtVerify = mock.fn(async () => undefined);

mock.module('../src/credential-envelope-codec.js', {
  namedExports: {
    ...credentialEnvelopeCodec,
    decodeCredentialEnvelope,
  },
});
mock.module('../src/core.js', {
  namedExports: {
    ...jwtCore,
    jwsVerify,
    jwtVerify,
  },
});

const {
  verifyCredentialEnvelope,
} = require('../src/credential-envelope-verifier');
const { verifyCredentialJwt } = require('../src/verifiable-decoders');

describe('credential envelope codec reuse guardrails', () => {
  beforeEach(() => {
    decodeCredentialEnvelope.mock.resetCalls();
    jwsVerify.mock.resetCalls();
    jwtVerify.mock.resetCalls();
  });

  after(() => {
    mock.reset();
  });

  it('decodes once inside verifyCredentialEnvelope and trusts that result only after crypto', async () => {
    const result = await verifyCredentialEnvelope(compact, verificationKey);

    expect(decodeCredentialEnvelope.mock.callCount()).toBe(1);
    expect(jwsVerify.mock.calls[0].arguments).toEqual([
      compact,
      verificationKey,
    ]);
    expect(result.credential).toBe(credential);
  });

  it('does not pre-decode in verifyCredentialJwt before the envelope verifier', async () => {
    const result = await verifyCredentialJwt(compact, verificationKey);

    expect(decodeCredentialEnvelope.mock.callCount()).toBe(1);
    expect(jwtVerify.mock.calls[0].arguments).toEqual([
      compact,
      verificationKey,
    ]);
    expect(result).toBe(credential);
  });
});
