/*
 * Copyright 2024 Velocity Team
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

const { after, before, describe, it } = require('node:test');
const { expect } = require('expect');

const console = require('console');
const { MongoClient } = require('mongodb');
const { nanoid } = require('nanoid');
const { addYears } = require('date-fns');
const { filter, first, /* map, */ omit, replace } = require('lodash/fp');
const { KeyPurposes /* generateKeyPair */ } = require('@verii/crypto');
const {
  // applyOverrides,
  formatAsDate,
} = require('@verii/common-functions');
const {
  DID_FORMAT,
  OBJECT_ID_FORMAT,
  ISO_DATETIME_FORMAT,
} = require('@verii/test-regexes');
const { ServiceTypes } = require('@verii/organizations-registry');
// const {
//   jwtDecode,
//   jwtVerify,
//   generateDocJwt,
//   generatePresentationJwt,
//   toJwk,
//   jwtSign,
// } = require('@verii/jwt');
// const { getDidUriFromJwk } = require('@verii/did-doc');
// const { hashOffer } = require('@verii/verii-issuing');
// const { CheckResults } = require('@verii/vc-checks');

const { addMonths } = require('date-fns/fp');
const { initVerificationCoupon } = require('@verii/metadata-registration');
const { initProvider } = require('@verii/base-contract-io');
const dotenv = require('dotenv');
const path = require('path');
const { toHexString } = require('@verii/blockchain-functions');
const { Authorities } = require('@verii/endpoints-organizations-registrar');
// const {
//   sampleEducationDegreeGraduation,
// } = require('@verii/sample-data');
// const { jwtVcExpectation } = require('../test/helpers/jwt-vc-expectation');
const { VendorEndpoint, ConfigurationType } = require('../src/entities');

const registrarUrl = 'https://localhost:13004';
const fineractUrl = 'http://localhost:13008';
const caUrl = 'http://localhost:13012';
const rpcUrl = 'http://localhost:18545';
const mockvendorUrl = 'http://localhost:13013';

const authenticate = () => 'TOKEN';
const rpcProvider = initProvider(rpcUrl, authenticate);
const e2eEnv = {};
dotenv.config({
  path: path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    'samples',
    'sample-registrar-server',
    '.localdev.env',
  ),
  processEnv: e2eEnv,
});
console.dir(e2eEnv);

const OPERATOR_API_TOKEN =
  'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoidmVsb2NpdHkuYWRtaW5AZXhhbXBsZS5jb20ifQ.kmp4qjkgnVOX3eXdgNdUwYKDZ7NgEfH5qMM-7k1D1c8';
// const EDUCATION_DEGREE_CREDENTIAL_TYPE = 'EducationDegreeGraduationV1.1';

describe('org registration and issuing e2e', () => {
  let client;

  // let holderKeyPair;
  // let holderDid;

  after(async () => {
    await client.close();
  });
  before(async () => {
    client = await MongoClient.connect('mongodb://localhost:17017');

    // Generate holder DID and key pair for fake wallet
    // holderKeyPair = generateKeyPair({ format: 'jwk' });
    // holderDid = getDidUriFromJwk(holderKeyPair.publicKey);
  });

  it('register org, create tenant, preauth service, depot & credential and have holder claim it and finally verify a presentation', async () => {
    const profilePayload = {
      name: `ACME Corp: ${nanoid(6)}`,
      logo: 'http://www.acmecorp.com/corporate-logo.png',
      contactEmail: 'contact@acmecorp.com',
      technicalEmail: 'contact@acmecorp.com',
      commercialEntities: [
        {
          type: 'Brand',
          name: 'BETA Max',
          logo: 'https://www.acmecorp.com/betamax-logo.png',
        },
      ],
      website: 'https://www.credentialagent.com',
      registrationNumbers: [
        {
          authority: Authorities.DunnAndBradstreet,
          number: '123457779',
          uri: 'https://uri.com',
        },
      ],
      location: {
        countryCode: 'US',
        regionCode: 'US-IL',
      },
      type: 'company',
      founded: '2020-01-01',
      description: 'Short description',
      linkedInProfile: 'https://www.linkedin.com/in/test-profile',
      physicalAddress: {
        line1: '123 Main St',
        line2: 'Suite 123',
        line3: 'New York',
      },
      adminGivenName: 'Admin Given Name',
      adminFamilyName: 'Admin Family Name',
      adminTitle: 'Admin Title',
      adminEmail: 'admin@email.com',
      signatoryGivenName: 'Signatory Given Name',
      signatoryFamilyName: 'Signatory Family Name',
      signatoryTitle: 'Signatory Title',
      signatoryEmail: 'signatory@email.com',
    };

    const serviceEndpoints = [
      {
        id: '#cao1',
        type: ServiceTypes.CredentialAgentOperatorType,
        serviceEndpoint: replace('http', 'https', caUrl),
      },
      {
        id: '#issuer1',
        type: ServiceTypes.CareerIssuerType,
        serviceEndpoint: replace('http', 'https', caUrl),
      },
      {
        id: '#rp1',
        type: ServiceTypes.InspectionType,
        serviceEndpoint: replace('http', 'https', caUrl),
      },
    ];

    const authResponse = await fetch('http://localhost:13000/oauth/token', {
      method: 'POST',
      body: JSON.stringify({
        client_id: 'client_id',
        client_secret: 'client_secret',
        audience: 'testAudience',
        grant_type: 'client_credentials',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const authJson = await authResponse.json();

    const createFullOrganizationResponse = await fetch(
      `${registrarUrl}/api/v0.6/organizations/full`,
      {
        method: 'POST',
        body: JSON.stringify({
          profile: profilePayload,
          serviceEndpoints,
        }),
        headers: {
          'x-auto-activate': '1',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authJson.access_token}`,
        },
      },
    ).then((r) => r.json());

    // json response checks
    expect(createFullOrganizationResponse.id).toMatch(DID_FORMAT);
    const { id: did, /* ids, profile, */ keys } =
      createFullOrganizationResponse;
    console.dir({ msg: 'Organization registered', did });

    const fineractAuthResponse = await fetch(
      'http://localhost:13000/oauth/token',
      {
        method: 'POST',
        body: JSON.stringify({
          client_id: 'client_id',
          client_secret: 'client_secret',
          audience: 'https://fineract.velocitycareerlabs.io',
          grant_type: 'client_credentials',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
    const quantity = 100;
    const expiry = addMonths(3, new Date());
    const fineractAuthJson = await fineractAuthResponse.json();
    const mint = await initMintBundle();
    const { bundleId } = await mint({
      toAddress: createFullOrganizationResponse.ids.ethereumAccount,
      expirationTime: expiry,
      quantity,
      ownerDid: createFullOrganizationResponse.ids.did,
    });
    const createVoucherResponse = await fetch(
      `${fineractUrl}/fineract-provider/api/v1/datatables/Voucher/${createFullOrganizationResponse.ids.fineractClientId}?genericResultSet=true`,
      {
        method: 'POST',
        body: JSON.stringify({
          couponBundleId: toHexString(bundleId),
          symbol: 'VVO',
          quantity: `${quantity}`,
          used: '0',
          locale: 'en',
          dateFormat: 'yyyy-MM-dd',
          expiry: formatAsDate(expiry),
        }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${fineractAuthJson.access_token}`,
          'fineract-platform-tenantid': 'default',
        },
      },
    );
    expect(createVoucherResponse.status).toEqual(200);
    await expect(createVoucherResponse.json()).resolves.toEqual({
      clientId: parseInt(
        createFullOrganizationResponse.ids.fineractClientId,
        10,
      ),
      officeId: 1,
      resourceId: expect.any(Number),
    });

    const balanceQuery2Response = await fetch(
      `${fineractUrl}/fineract-provider/api/v1/vouchers/${createFullOrganizationResponse.ids.fineractClientId}/balance`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${fineractAuthJson.access_token}`,
          'fineract-platform-tenantid': 'default',
        },
      },
    );
    await expect(balanceQuery2Response.json()).resolves.toEqual({
      balance: 100,
    });

    // Tenant Creation
    const createTenantPayload = {
      did,
      serviceIds: serviceEndpoints.map(({ id }) => `${did}${id}`),
      keys: filter(
        ({ purposes }) =>
          [
            KeyPurposes.DLT_TRANSACTIONS,
            KeyPurposes.EXCHANGES,
            KeyPurposes.ISSUING_METADATA,
          ].includes(first(purposes)),
        keys,
      ),
    };

    // Create tenant

    const createTenantResponse = await fetch(
      `${caUrl}/operator-api/v0.8/tenants`,
      {
        method: 'POST',
        body: JSON.stringify(createTenantPayload),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPERATOR_API_TOKEN}`,
        },
      },
    );
    expect(createTenantResponse.status).toEqual(201);
    const createTenantJson = await createTenantResponse.json();
    expect(createTenantJson).toEqual({
      id: expect.stringMatching(OBJECT_ID_FORMAT),
      createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
    });

    // Create mockvendor user
    const user = {
      firstName: 'Adam',
      lastName: 'Smith',
      emails: ['adam.smith@example.com'],
      phones: ['+44 7963587331'],
      address: {
        line1: 'Sunburst Lane 1',
        line2: 'Phoenix',
        countryCode: 'US',
        regionCode: 'AZ',
      },
    };

    const createUserResponse = await fetch(`${mockvendorUrl}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(user),
    });

    expect(createUserResponse.status).toEqual(200);
    const createUserJson = await createUserResponse.json();
    expect(createUserJson).toEqual({
      ...user,
      id: expect.stringMatching(OBJECT_ID_FORMAT),
      _id: expect.stringMatching(OBJECT_ID_FORMAT),
      updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
    });

    // Create mockvendor offer
    const offer = {
      type: ['Course'],
      issuer: {
        id: 'did:ion:B1a3e076-8d23-4bcb-a066-6f90e161cf23',
      },
      credentialSubject: {
        vendorUserId: 'adam.smith@example.com',
        title: {
          localized: {
            en: 'Azure Basics',
          },
        },
        description: {
          localized: {
            en: 'Introduction to Microsoft Azure Cloud Services',
          },
        },
        contentProvider:
          'did:velocity:0xd4df29726d500f9b85bc6c7f1b3c021f16305692',
        contentProviderName: {
          localized: {
            en: 'Microsoft Corporation',
          },
        },
        type: 'Specialty Training',
        duration: '24h',
        score: 90.0,
        scoreRange: '78',
        registrationDate: {
          day: 15.0,
          month: 3.0,
          year: 2019.0,
        },
        startDate: {
          day: 1.0,
          month: 4.0,
          year: 2019.0,
        },
        completionDate: {
          day: 1.0,
          month: 5.0,
          year: 2019.0,
        },
        alignment: [
          {
            targetName: 'Microsoft top secret course',
            targetUrl: 'https://www.microsoft.com',
            targetDescription: 'Test Description Data',
          },
        ],
      },
      offerId: '5539e308-6f2f-4d01-b946-5ca4ba7fee20',
    };

    const createOfferResponse = await fetch(`${mockvendorUrl}/api/offers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(offer),
    });

    expect(createOfferResponse.status).toEqual(200);
    const createOfferJson = await createOfferResponse.json();
    expect(first(createOfferJson)).toEqual({
      ...expectedOffer(offer),
      id: expect.stringMatching(OBJECT_ID_FORMAT),
      _id: expect.stringMatching(OBJECT_ID_FORMAT),
      createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
    });

    // Create disclosure
    const disclosure = {
      vendorDisclosureId: 'HR-PKG-USPS-CLRK',
      purpose: 'Job Application',
      description: 'Clerk',
      duration: '6y',
      sendPushOnVerification: false,
      deactivationDate: addYears(new Date(), 10),
      authTokensExpireIn: 10080,
      types: [
        { type: 'PastEmploymentPosition' },
        { type: 'CurrentEmploymentPosition' },
      ],
      identificationMethods: ['preauth'],
      configurationType: ConfigurationType.ISSUING,
      vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
      offerMode: 'webhook',
      termsUrl:
        'https://www.velocityexperiencecenter.com/terms-and-conditions-vnf',
    };

    const createDisclosureResponse = await fetch(
      `${caUrl}/operator-api/v0.8/tenants/${createTenantJson.id}/disclosures`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${OPERATOR_API_TOKEN}`,
        },
        body: JSON.stringify(disclosure),
      },
    );

    expect(createDisclosureResponse.status).toEqual(201);
    const createDisclosureJson = await createDisclosureResponse.json();
    expect(createDisclosureJson).toEqual({
      ...omit(['setIssuingDefault'])(disclosure),
      deactivationDate: expect.any(String),
      identificationMethods: ['preauth'],
      sendPushOnVerification: false,
      feed: false,
      id: expect.stringMatching(OBJECT_ID_FORMAT),
      createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
    });
  }, 30000);
});

const initMintBundle = async () => {
  const { mint } = await initVerificationCoupon(
    {
      privateKey: e2eEnv.ROOT_PRIVATE_KEY,
      contractAddress: e2eEnv.COUPON_CONTRACT_ADDRESS,
      rpcProvider,
    },
    { log: console, traceId: nanoid() },
  );

  return mint;
};

const expectedOffer = (payload, overrides = {}) =>
  omit(['_id', 'createdAt', 'exchangeId', 'updatedAt'], {
    ...payload,
    ...overrides,
  });

// const expectedTenant = (tenant, primaryAccount) => ({
//   id: tenant._id ?? expect.stringMatching(OBJECT_ID_FORMAT),
//   createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
//   updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
//   hostUrl: 'http://localhost:13002',
//   primaryAccount,
//   ...omit(['_id', 'primaryAccount'], tenant),
// });

// const expectedKeyMetadatas = map((key) => ({
//   ...omit(['key', 'didDocumentKey'], key),
//   id: expect.stringMatching(OBJECT_ID_FORMAT),
//   createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
//   encoding: 'jwk',
// }));

// const expectedEntity = (payload, overrides) =>
//   applyOverrides(
//     {
//       ...payload,
//       id: expect.stringMatching(OBJECT_ID_FORMAT),
//       createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
//       updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
//     },
//     overrides
//   );

// const expectedSearchParams = (tenant, service, depot, preauthCode) => {
//   let searchParamsString = `request_uri=${encodeURIComponent(
//     caUrl
//   )}%2Fvn-api%2Fr%2F${encodeURIComponent(
//     encodeURI(tenant.did)
//   )}%2Fget-credential-manifest%3Fid%3D${encodeURIComponent(service.id)}`;
//   searchParamsString += `&issuerDid=${encodeURIComponent(tenant.did)}`;
//   if (preauthCode != null) {
//     searchParamsString += `&vendorOriginContext=${encodeURIComponent(
//       `depot:${depot.id}:${preauthCode}`
//     )}`;
//   }
//   return searchParamsString;
// };

// const expectedCredentialManifest = (
//   profile,
//   tenant,
//   issuerService,
//   payload
// ) => ({
//   exchange_id: expect.any(String),
//   output_descriptors: map(() => expect.any(Object), payload?.credential_types),
//   issuer: {
//     id: tenant.did,
//   },
//   presentation_definition: {
//     id: expect.any(String),
//     format: {
//       jwt_vp: { alg: ['secp256k1'] },
//     },
//     name: issuerService.description,
//     purpose: issuerService.disclosureRequest?.purpose ?? '',
//     input_descriptors: map(
//       () => expect.any(Object),
//       issuerService.disclosureRequest?.types
//     ),
//     submission_requirements:
//       issuerService.disclosureRequest?.types != null
//         ? [
//             {
//               from: 'A',
//               min: 1,
//               rule: 'all',
//             },
//           ]
//         : [],
//     ...issuerService.presentationDefinition,
//   },
//   metadata: {
//     client_name: issuerService.commercialEntity?.name ?? profile.name,
//     logo_uri: issuerService.commercialEntity?.logo ?? profile.logo,
//     tos_uri: issuerService.termsUrl,
//     max_retention_period:
//       issuerService.disclosureRequest?.retentionPeriod ?? '',
//     progress_uri: `${caUrl}${vnUrl(tenant)}/get-exchange-progress`,
//     submit_presentation_uri: `${caUrl}${vnUrl(tenant)}/authenticate`,
//     check_offers_uri: `${caUrl}${vnUrl(tenant)}/credential-offers`,
//     finalize_offers_uri: `${caUrl}${vnUrl(tenant)}/issue-credentials`,
//   },
// });

// const buildProof = async (
//   url,
//   didJwk,
//   keyPair,
//   challenge,
//   { useKid = true, ...payloadOverrides } = {}
// ) => {
//   const options = {
//     jwk: keyPair.publicKey,
//     alg: keyPair.publicKey.crv === 'P-256' ? 'ES256' : 'ES256K',
//   };
//   if (useKid) options.kid = `${didJwk}#0`;
//   const jwt = await jwtSign(
//     applyOverrides(
//       {
//         aud: url,
//         nonce: challenge,
//         iss: didJwk,
//       },
//       payloadOverrides
//     ),
//     keyPair.privateKey,
//     options
//   );
//   return {
//     proof_type: 'jwt',
//     jwt,
//   };
// };

// const vnUrl = ({ did }) => `/vn-api/r/${encodeURI(did)}`;

// const generatePreauthCodeAuthJwt = (
//   depot,
//   vendorOriginContext,
//   holderDid,
//   keyPair
// ) => {
//   const didJwk = getDidUriFromJwk(keyPair.publicKey);
//   const options = {
//     issuer: didJwk,
//     jti: nanoid(),
//     kid: `${didJwk}#0`,
//   };
//   const payload = {
//     id: nanoid(),
//     issuer: holderDid,
//     vp: {
//       presentation_submission: {
//         id: nanoid(),
//         definition_id: nanoid(),
//       },
//     },
//   };
//   if (vendorOriginContext != null) {
//     payload.vp.vendorOriginContext = vendorOriginContext;
//   }
//   return generateDocJwt(payload, keyPair.privateKey, options);
// };
