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

const { createPrivateKey, randomBytes, sign } = require('node:crypto');
const { generateKeyPair } = require('@verii/crypto');
const {
  generateCredentialJwt,
  generateDocJwt,
  generatePresentationJwt,
  jwtSign,
} = require('@verii/jwt');
const { applyOverrides, mapWithIndex } = require('@verii/common-functions');
const { getDidUriFromJwk } = require('@verii/did-doc');
const {
  VelocityRevocationListType,
  VeriiProtocolVersions,
} = require('@verii/vc-checks');
const { nanoid } = require('nanoid');
const { map } = require('lodash/fp');
const { mockHttpClientJsonRoute } = require('./mock-http-client');

const EMAIL_CREDENTIAL_TYPE = 'EmailV1.0';

const emailIssuerService = (overrides = {}) => ({
  authMethods: ['verifiable_presentation'],
  authMode: 'internal',
  disclosureRequest: {
    types: [{ type: EMAIL_CREDENTIAL_TYPE }],
    purpose: 'Identification',
    retentionPeriod: 'P1D',
  },
  verifiablePresentationAuthRules: [
    {
      path: [['credentialSubject', 'email']],
      rule: 'pick',
      valueIndex: 0,
      type: EMAIL_CREDENTIAL_TYPE,
    },
  ],
  ...overrides,
});

const generateHolder = () => {
  const keyPair = generateKeyPair({ format: 'jwk' });
  return { keyPair, did: getDidUriFromJwk(keyPair.publicKey) };
};

const generateEmailIssuer = async () => {
  const keyPair = generateKeyPair({ format: 'jwk' });
  const did = `did:test:email-issuer-${randomBytes(8).toString('hex')}`;
  const boundIssuerVc = await jwtSign(
    {
      iss: did,
      vc: { id: '0', credentialSubject: { listId: 1, accountId: 'A' } },
    },
    keyPair.privateKey,
    { kid: `${did}#key-1` },
  );
  return { did, keyPair, boundIssuerVc };
};

// Registers the registrar routes that the issuer checks of an email or phone
// credential need: the issuer's DID document, its verified profile and the
// credential types' metadata. A route named in `unavailable` isn't
// registered, so fetching it fails.
const mockEmailIssuerRoutes = (
  issuer,
  {
    permittedVelocityServiceCategory = ['ContactIssuer'],
    unavailable = [],
  } = {},
) => {
  const routes = {
    didDocument: [
      `api/v0.6/resolve-did/${encodeURIComponent(issuer.did)}`,
      {
        id: issuer.did,
        publicKey: [{ id: '#key-1', publicKeyJwk: issuer.keyPair.publicKey }],
      },
    ],
    verifiedProfile: [
      `api/v0.6/organizations/${encodeURIComponent(issuer.did)}/verified-profile`,
      {
        credentialSubject: {
          id: issuer.did,
          permittedVelocityServiceCategory,
        },
      },
    ],
    credentialTypes: [
      'api/v0.6/credential-types',
      [
        {
          credentialType: EMAIL_CREDENTIAL_TYPE,
          issuerCategory: 'ContactIssuer',
        },
        { credentialType: 'PhoneV1.0', issuerCategory: 'ContactIssuer' },
      ],
    ],
    credentialTypeDescriptor: [
      `api/v0.6/credential-type-descriptors/${EMAIL_CREDENTIAL_TYPE}`,
      {
        id: EMAIL_CREDENTIAL_TYPE,
        name: EMAIL_CREDENTIAL_TYPE,
        schema: [{ uri: 'https://example.com/email-v1.0.schema.json' }],
      },
    ],
  };
  for (const [name, [url, response]] of Object.entries(routes)) {
    if (!unavailable.includes(name)) {
      mockHttpClientJsonRoute('get', url, response);
    }
  }
};

// A did:velocity credential bound to the holder's DID. `overrides` are
// applied to the credential before it's signed.
const generateCredential = async ({
  issuer,
  holderDid,
  type = EMAIL_CREDENTIAL_TYPE,
  credentialSubject,
  overrides,
}) => {
  const id = `did:velocity:v2:${randomBytes(8).toString('hex')}:1:1`;
  const keyPair = generateKeyPair({ format: 'jwk' });
  const credential = applyOverrides(
    {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      id,
      type: [type, 'VerifiableCredential'],
      issuer: { id: issuer.did },
      issuanceDate: new Date().toISOString(),
      expirationDate: '2050-01-01T00:00:00.000Z',
      credentialSubject: { ...credentialSubject, id: holderDid },
      credentialStatus: {
        type: VelocityRevocationListType,
        id: 'ethereum:URL:2',
      },
      vnfProtocolVersion: VeriiProtocolVersions.PROTOCOL_VERSION_2,
    },
    overrides,
  );
  const jwt = await generateCredentialJwt(
    credential,
    keyPair.privateKey,
    `${id}#key-1`,
  );
  return { id, keyPair, credential, jwt, boundIssuerVc: issuer.boundIssuerVc };
};

// A VC 1.1 did:velocity email credential JWT whose vc.credentialSubject is
// given as is, so it can be an array, with sub naming the holder.
// generateCredentialJwt would merge an array of subjects into one object.
const generateRawV1EmailCredential = async ({
  issuer,
  holderDid,
  credentialSubject,
}) => {
  const id = `did:velocity:v2:${randomBytes(8).toString('hex')}:1:1`;
  const keyPair = generateKeyPair({ format: 'jwk' });
  const credential = {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: [EMAIL_CREDENTIAL_TYPE, 'VerifiableCredential'],
    issuer: { id: issuer.did },
    credentialSubject,
    credentialStatus: {
      type: VelocityRevocationListType,
      id: 'ethereum:URL:2',
    },
    vnfProtocolVersion: VeriiProtocolVersions.PROTOCOL_VERSION_2,
  };
  const jwt = await generateDocJwt({ vc: credential }, keyPair.privateKey, {
    issuer: issuer.did,
    jti: id,
    kid: `${id}#key-1`,
    subject: holderDid,
  });
  return { id, keyPair, credential, jwt, boundIssuerVc: issuer.boundIssuerVc };
};

// A VC 2.0 did:velocity email credential, signed as a vc+jwt envelope. Its
// credentialSubject is given as is, so it can name more than one subject.
const generateV2EmailCredential = ({ issuer, credentialSubject }) => {
  const id = `did:velocity:v2:${randomBytes(8).toString('hex')}:1:1`;
  const keyPair = generateKeyPair({ format: 'jwk' });
  const credential = {
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    id,
    type: ['VerifiableCredential', EMAIL_CREDENTIAL_TYPE],
    issuer: issuer.did,
    validFrom: '2026-01-01T00:00:00.000Z',
    validUntil: '2099-01-01T00:00:00.000Z',
    credentialSubject,
    credentialStatus: {
      type: VelocityRevocationListType,
      id: 'ethereum:URL:2',
    },
  };
  const jwt = compactSign(credential, keyPair.privateKey, {
    alg: 'ES256K',
    cty: 'vc',
    kid: `${id}#key-1`,
    typ: 'vc+jwt',
  });
  return { id, keyPair, credential, jwt, boundIssuerVc: issuer.boundIssuerVc };
};

const compactSign = (payload, privateJwk, protectedHeader) => {
  const signingInput = [protectedHeader, payload]
    .map((part) => Buffer.from(JSON.stringify(part)).toString('base64url'))
    .join('.');
  const signature = sign('sha256', Buffer.from(signingInput), {
    dsaEncoding: 'ieee-p1363',
    key: createPrivateKey({ format: 'jwk', key: privateJwk }),
  });
  return `${signingInput}.${signature.toString('base64url')}`;
};

const generateEmailCredential = ({ email, ...args }) =>
  generateCredential({ ...args, credentialSubject: { email } });

// A VP submitted to the exchange, signed by the holder with `iss` and `kid`
// naming the holder's did:jwk. `overrides` are applied to the presentation.
const generateAuthVp = ({ exchange, holder, jwtVcs, overrides }) =>
  generatePresentationJwt(
    applyOverrides(
      {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        id: nanoid(),
        type: ['VerifiablePresentation'],
        issuer: holder.did,
        verifiableCredential: jwtVcs,
        presentation_submission: {
          id: nanoid(),
          definition_id: `${exchange._id}.${exchange.serviceId}`,
          descriptor_map: mapWithIndex(
            (jwtVc, index) => ({
              id: EMAIL_CREDENTIAL_TYPE,
              path: `$.verifiableCredential[${index}]`,
              format: 'jwt_vc',
            }),
            jwtVcs,
          ),
        },
      },
      overrides,
    ),
    holder.keyPair.privateKey,
    `${holder.did}#0`,
  );

// The same VP as generateAuthVp, signed with exactly the JWT claims given: no
// nbf, and a jti or iat only when one is given.
const signAuthVp = ({ exchange, holder, jwtVcs, jti, iat }) =>
  compactSign(
    {
      iss: holder.did,
      ...(jti == null ? {} : { jti }),
      ...(iat == null ? {} : { iat }),
      vp: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        verifiableCredential: jwtVcs,
        presentation_submission: {
          id: nanoid(),
          definition_id: `${exchange._id}.${exchange.serviceId}`,
          descriptor_map: mapWithIndex(
            (jwtVc, index) => ({
              id: EMAIL_CREDENTIAL_TYPE,
              path: `$.verifiableCredential[${index}]`,
              format: 'jwt_vc',
            }),
            jwtVcs,
          ),
        },
      },
    },
    holder.keyPair.privateKey,
    { alg: 'ES256K', kid: `${holder.did}#0`, typ: 'JWT' },
  );

// What the metadata registry returns for a set of did:velocity credentials.
const didVelocityResolution = (credentials) => ({
  didDocument: {
    id: `did:velocity:v2:multi:${map(
      ({ id }) => id.split(':').slice(3).join(':'),
      credentials,
    ).join(';')}`,
    publicKey: map(
      ({ id, keyPair }) => ({
        id: `${id}#key-1`,
        publicKeyJwk: keyPair.publicKey,
      }),
      credentials,
    ),
    service: ['SERVICE'],
  },
  didDocumentMetadata: {
    boundIssuerVcs: map(
      ({ id, boundIssuerVc }) => ({
        id,
        format: 'jwt_vc',
        vc: boundIssuerVc,
      }),
      credentials,
    ),
  },
  didResolutionMetadata: {},
});

module.exports = {
  EMAIL_CREDENTIAL_TYPE,
  didVelocityResolution,
  emailIssuerService,
  generateAuthVp,
  generateCredential,
  generateEmailCredential,
  generateEmailIssuer,
  generateHolder,
  generateRawV1EmailCredential,
  generateV2EmailCredential,
  mockEmailIssuerRoutes,
  signAuthVp,
};
