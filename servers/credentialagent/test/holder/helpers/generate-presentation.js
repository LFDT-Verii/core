/**
 * Copyright 2023 Velocity Team
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

const { generateKeyPair } = require('@verii/crypto');
const { mapWithIndex } = require('@verii/common-functions');
const {
  castArray,
  fromPairs,
  get,
  map,
  merge,
  pick,
  set,
  values,
  unset,
  slice,
  size,
} = require('lodash/fp');
const { nanoid } = require('nanoid/non-secure');
const {
  jwkFromSecp256k1Key,
  generateDocJwt,
  generateCredentialJwt,
  generatePresentationJwt,
  jwkThumbprint,
} = require('@verii/jwt');
const { ExchangeProtocols } = require('../../../src/entities');

const credential1 = {
  sub: 'did:velocity:0xda16fdbde1f8b73d1c981e6988bbca37fcdaa6ae',
  vc: {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    id: 'did:velocity:0xda16fdbde1f8b73d1c981e6988bbca37fcdaa6ae',
    type: ['IdDocumentV1.0', 'VerifiableCredential'],
    issuer: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
    credentialSubject: {
      firstName: {
        localized: {
          en: 'Adam',
        },
      },
      lastName: {
        localized: {
          en: 'Smith',
        },
      },
      dob: {
        day: 3,
        month: 3,
        year: 1971,
      },
      kind: 'DriversLicense',
      authority: 'California DMV',
      identityNumber: '12310312312',
      location: {
        countryCode: 'US',
        regionCode: 'CA',
      },
      address: {
        line1: '400 Bell St',
        line2: 'East Palo Alto',
        postcode: '94303',
        regionCode: 'CA',
        countryCode: 'US',
      },
    },
    credentialStatus: {
      id: 'https://credentialstatus.velocitycareerlabs.io',
      type: 'VelocityRevocationRegistry',
    },
  },
};

const credential2 = {
  sub: 'did:velocity:0x358f694f4ba5f00c15f7e92ecc3e4ccac7ca5f00',
  vc: {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    id: 'did:velocity:0x358f694f4ba5f00c15f7e92ecc3e4ccac7ca5f00',
    type: ['CurrentEmploymentPosition', 'VerifiableCredential'],
    issuer: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
    issuanceDate: '2020-08-17T11:26:49.000Z',
    credentialSubject: {
      company: 'did:velocity:iamanissuer1234567890',
      companyName: {
        localized: {
          en: 'ACME Corporation',
        },
      },
      title: {
        localized: {
          en: 'Programme Manager',
        },
      },
      startMonthYear: {
        month: 2,
        year: 2015,
      },
      location: {
        countryCode: 'US',
        regionCode: 'CA',
      },
      description:
        'Responsible for digital transformation portfolio at ACME Corporation',
    },
    credentialStatus: {
      id: 'https://credentialstatus.velocitycareerlabs.io',
      type: 'VelocityRevocationRegistry',
    },
  },
};

const credential3 = {
  sub: 'did:velocity:0x0a63c18d09d5430363b2f3b270698a677fb513e4',
  vc: {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    id: 'did:velocity:0x0a63c18d09d5430363b2f3b270698a677fb513e4',
    type: ['EducationDegree', 'VerifiableCredential'],
    issuer: { id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa' },
    issuanceDate: '2020-08-17T11:27:06.000Z',
    credentialSubject: {
      school: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
      schoolName: {
        localized: {
          en: 'University of Cambridge',
        },
      },
      degreeName: {
        localized: {
          en: 'Bachelor',
        },
      },
      program: {
        localized: {
          en: 'Computer Science',
        },
      },
      startMonthYear: {
        month: 9,
        year: 2002,
      },
      endMonthYear: {
        month: 5,
        year: 2005,
      },
    },
    credentialStatus: {
      id: 'https://credentialstatus.velocitycareerlabs.io',
      type: 'VelocityRevocationRegistry',
    },
  },
};

const credential4 = {
  sub: 'did:ethr.0x0a63c18d09d5430363b2f3b270698a677fb513e4',
  vc: {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    id: 'did:ethr.0x0a63c18d09d5430363b2f3b270698a677fb513e5',
    type: ['EmailV1.0', 'VerifiableCredential'],
    issuer: { id: 'did:ethr.0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa' },
    issuanceDate: '2020-08-17T11:27:06.000Z',
    credentialSubject: {
      email: 'adam.smith@example.com',
    },
  },
};

const idDocPayload = {
  sub: 'did:velocity:0x0a63c18d09d5430363b2f3b270698a677fb513e4',
  vc: {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    id: 'did:velocity:0x0a63c18d09d5430363b2f3b270698a677fb513e4',
    issuer: { id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa' },
    issuanceDate: '2020-08-17T11:27:06.000Z',
    type: ['IdDocumentV1.0', 'VerifiableCredential'],
    credentialSubject: {
      person: {
        givenName: 'Sam',
        familyName: 'Smith',
      },
      validity: {
        validFrom: '2017-09-01',
        validUntil: '2021-09-01',
      },
    },
  },
};

const driversLicensePayload = {
  sub: 'did:velocity:0x0a63c18d09d5430363b2f3b270698a677fb513e4',
  vc: {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    id: 'did:velocity:0x0a63c18d09d5430363b2f3b270698a677fb513e4',
    issuer: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
    issuanceDate: '2020-08-17T11:27:06.000Z',
    type: ['DriversLicensesV1.0', 'VerifiableCredential'],
    credentialSubject: {
      person: {
        givenName: 'Sam',
        familyName: 'Smith',
      },
      identifier: '2200221100',
    },
  },
};

const legacyIdDocPayload = {
  sub: 'did:velocity:0x0a63c18d09d5430363b2f3b270698a677fb513e4',
  vc: {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    id: 'did:velocity:0x0a63c18d09d5430363b2f3b270698a677fb513e4',
    issuer: { id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa' },
    issuanceDate: '2020-08-17T11:27:06.000Z',
    type: ['IdDocument', 'VerifiableCredential'],
    credentialSubject: {
      firstName: { localized: { en: 'Sam' } },
      lastName: { localized: { en: 'Smith' } },
    },
    validFrom: '2017-09-01',
    validUntil: '2021-09-01',
  },
};

const verificationIdentifierPayload = {
  sub: 'did:velocity:0x0a63c18d09d5430363b2f3b270698a677fb513e4',
  vc: {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    id: 'did:velocity:0x0a63c18d09d5430363b2f3b270698a677fb513e4',
    issuer: { id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa' },
    issuanceDate: '2020-08-17T11:27:06.000Z',
    type: ['VerificationIdentifier', 'VerifiableCredential'],
    credentialSubject: {
      id: 'dff447309917830',
    },
  },
};

const phonePayload = {
  sub: 'did:velocity:0x0a63c18d09d5430363b2f3b270698a677fb513e4',
  vc: {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    id: 'did:velocity:0x0a63c18d09d5430363b2f3b270698a677fb513e4',
    issuer: { id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa' },
    issuanceDate: '2020-08-17T11:27:06.000Z',
    type: ['PhoneV1.0', 'VerifiableCredential'],
    credentialSubject: {
      phone: '+447309917830',
    },
  },
};

const emailPayload = {
  sub: 'did:velocity:0x0a63c18d09d5430363b2f3b270698a677fb513e4',
  vc: {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    id: 'did:velocity:0x0a63c18d09d5430363b2f3b270698a677fb513e4',
    issuer: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
    issuanceDate: '2020-08-17T11:27:06.000Z',
    type: ['EmailV1.0', 'VerifiableCredential'],
    credentialSubject: {
      email: 'adam.smith@example.com',
    },
  },
};
const legacyEmailPayload = {
  sub: 'did:velocity:0x0a63c18d09d5430363b2f3b270698a677fb513e4',
  vc: {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    id: 'did:velocity:0x0a63c18d09d5430363b2f3b270698a677fb513e4',
    issuer: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
    issuanceDate: '2020-08-17T11:27:06.000Z',
    type: ['Email', 'VerifiableCredential'],
    credentialSubject: {
      email: 'adam.smith@example.com',
    },
  },
};

const whateverPayload = {
  sub: 'did:velocity:0x0a63c18d09d5430363b2f3b270698a677fb513e4',
  vc: {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    id: 'did:velocity:0x0a63c18d09d5430363b2f3b270698a677fb513e4',
    issuer: { id: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa' },
    issuanceDate: '2020-08-17T11:27:06.000Z',
    type: ['Whatever', 'VerifiableCredential'],
    credentialSubject: {
      email: 'adam.smith@example.com',
    },
  },
};

const { privateKey, publicKey } = generateKeyPair();

const generateKYCPresentation = (exchange, idDocTypes, options) => {
  const idCredentials = {
    email: emailPayload,
    legacyEmail: legacyEmailPayload,
    phone: phonePayload,
    idDocument: idDocPayload,
    driversLicense: driversLicensePayload,
    legacyIdDocument: legacyIdDocPayload,
    verificationIdentifier: verificationIdentifierPayload,
    whateverIdentifier: whateverPayload,
    whateverWithLogoName: {
      ...emailPayload,
      vc: {
        ...emailPayload.vc,
        issuer: {
          id: emailPayload.vc.issuer,
          image: 'https://example.com/image.png',
          name: 'Whatever',
        },
      },
    },
  };

  const selectedCredentials = idDocTypes
    ? pick(castArray(idDocTypes), idCredentials)
    : values(idCredentials);

  return doGeneratePresentation(selectedCredentials, exchange, options);
};

const generatePresentation = (exchange) => {
  return doGeneratePresentation(
    [credential1, credential2, credential3, credential4],
    exchange
  );
};

const doGeneratePresentation = async (
  credentials,
  exchange,
  options = { isBrokeVCS: false }
) => {
  const signedCredentials = await Promise.all(
    map((c) => generateCredentialJwt(c, privateKey), credentials)
  );

  const publicJwk = jwkFromSecp256k1Key(publicKey, false);

  const presentation =
    get('protocolMetadata.protocol', exchange) === ExchangeProtocols.OIDC_SIOP
      ? {
          id: nanoid(),
          state: exchange._id,
          sub: await jwkThumbprint(publicJwk),
          sub_jwk: publicJwk,
          aud: exchange.protocolMetadata.redirect_uri,
          nonce: exchange.protocolMetadata.nonce,
          iss: 'https://self-issuanceDate.me',
          ...fromPairs(
            mapWithIndex(
              (c, i) => [`signedCredential${i + 1}`, c],
              signedCredentials
            )
          ),
          presentation_submission: {
            id: nanoid(),
            definition_id: `${exchange._id}.${exchange.disclosureId}`,
            descriptor_map: mapWithIndex(
              (c, i) => ({
                id: nanoid(),
                path: `$.signedCredential${i + 1}`,
                format: 'jwt_vc',
              }),
              signedCredentials
            ),
          },
        }
      : {
          id: nanoid(),
          issuer: 'https://self-issuanceDate.me',
          verifiableCredential: options.isBrokeVCS
            ? [
                ...slice(0, 1, signedCredentials),
                ...Array(size(signedCredentials) - 1).fill(''),
              ]
            : signedCredentials,
          presentation_submission: {
            id: nanoid(),
            definition_id: `${exchange._id}.${exchange.disclosureId}`,
            descriptor_map: mapWithIndex(
              (c, i) => ({
                id: nanoid(),
                path: `$.verifiableCredential[${i}]`,
                format: 'jwt_vc',
              }),
              signedCredentials
            ),
          },
        };

  return {
    presentation,
    credentials,
    override(overrides) {
      return merge(this, { presentation: overrides });
    },
    delete(key) {
      return set('presentation', unset(key, this.presentation), this);
    },
    sign(kid, personPrivateKey, issuer = 'https://self-issuanceDate.me') {
      this.presentation.issuer = issuer;
      return generatePresentationJwt(this.presentation, personPrivateKey, kid);
    },
    selfSign() {
      return get('protocolMetadata.protocol', exchange) ===
        ExchangeProtocols.OIDC_SIOP
        ? generateDocJwt(this.presentation, privateKey, {
            // iss: this.presentation.iss,
            aud: this.presentation.aud,
            jti: nanoid(),
          })
        : generatePresentationJwt(this.presentation, privateKey);
    },
  };
};

module.exports = {
  generatePresentation,
  generateKYCPresentation,
  idDocPayload,
  legacyIdDocPayload,
  emailPayload,
  phonePayload,
  verificationIdentifierPayload,
};
