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
const console = require('console');
const crypto = require('node:crypto');
const http = require('node:http');
const path = require('path');
const { expect } = require('expect');
const { MongoClient } = require('mongodb');
const { nanoid, customAlphabet } = require('nanoid');
const { lowercase } = require('nanoid-dictionary');
const { filter, first, find, map, omit } = require('lodash/fp');
const {
  KeyPurposes,
  generateKeyPair,
  jwkFromSecp256k1Key,
} = require('@verii/crypto');
const {
  applyOverrides,
  formatAsDate,
  mapWithIndex,
  wait,
} = require('@verii/common-functions');
const {
  DID_FORMAT,
  OBJECT_ID_FORMAT,
  ISO_DATETIME_FORMAT,
} = require('@verii/test-regexes');
const { ServiceTypes } = require('@verii/organizations-registry');
const {
  jwtDecode,
  jwtVerify,
  generateDocJwt,
  generatePresentationJwt,
  jwtSign,
} = require('@verii/jwt');
const { getDidUriFromJwk } = require('@verii/did-doc');
const { hashOffer } = require('@verii/verii-issuing');
const { CheckResults } = require('@verii/vc-checks');
const { addMonths } = require('date-fns/fp');
const { initVerificationCoupon } = require('@verii/metadata-registration');
const { initProvider } = require('@verii/base-contract-io');
const dotenv = require('dotenv');
const { toHexString } = require('@verii/blockchain-functions');
const { KeyAlgorithms } = require('@verii/crypto');
const { jwtVcExpectation } = require('../test/helpers/jwt-vc-expectation');
const {
  sampleEducationDegreeGraduation,
} = require('../test/helpers/sample-education-degree-graduation');
const { CredentialFormat } = require('../src/entities/credentials');
const { PresentationFormat } = require('../src/entities/presentations');
const { NotificationEventTypes } = require('../src/entities/notifications');

const registrarUrl = 'https://localhost:13004';
const fineractUrl = 'http://localhost:13008';
const cihUrl = 'https://localhost:13002';
const rpcUrl = 'http://localhost:18545';
const WEBHOOK_RECEIVER_PORT = 13019;
const WEBHOOK_RECEIVER_PATH = '/cih-notification-webhooks';
const WEBHOOK_SECRET = 'e2e-notification-secret';

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
  quiet: true,
});
console.dir(e2eEnv);

const OPERATOR_API_TOKEN = 'foo';
const EDUCATION_DEGREE_CREDENTIAL_TYPE = 'EducationDegreeGraduationV1.1';

describe('org registration and issuing e2e', () => {
  let client;
  let webhookReceiver;
  let receivedWebhooks;

  let holderKeyPair;
  let holderDid;

  after(async () => {
    await new Promise((resolve, reject) => {
      webhookReceiver.close((error) => (error ? reject(error) : resolve()));
    });
    await client.close();
  });
  before(async () => {
    receivedWebhooks = [];
    webhookReceiver = await startWebhookReceiver(receivedWebhooks);
    client = await MongoClient.connect('mongodb://localhost:17017');

    // Generate holder DID and key pair for fake wallet
    holderKeyPair = generateKeyPair({ format: 'jwk' });
    holderDid = getDidUriFromJwk(holderKeyPair.publicKey);
  });

  it('register org, create tenant, preauth service, depot & credential and have holder claim it and finally verify a presentation', async () => {
    const profilePayload = {
      name: `ACME Corp: ${nanoid(6)}`,
      logo: 'https://www.acmecorp.com/corporate-logo.png',
      contactEmail: 'contact@acmecorp.com',
      technicalEmail: 'contact@acmecorp.com',
      commercialEntities: [
        {
          type: 'Brand',
          name: 'BETA Max',
          logo: 'https://www.acmecorp.com/betamax-logo.png',
        },
      ],
      website: `https://www.acmecorp-${customAlphabet(lowercase)()}.com`,
      registrationNumbers: [
        {
          authority: 'DunnAndBradstreet',
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
        serviceEndpoint: cihUrl,
      },
      {
        id: '#issuer1',
        type: ServiceTypes.CareerIssuerType,
        serviceEndpoint: cihUrl,
      },
      {
        id: '#rp1',
        type: ServiceTypes.InspectionType,
        serviceEndpoint: cihUrl,
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
    const { id: did, ids, profile, keys } = createFullOrganizationResponse;
    console.dir({ msg: 'Organization registered', did, keys });

    await wait(500);

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
      tenant: {
        did,
        caoDid: did,
        name: createFullOrganizationResponse.profile.name,
        logo: createFullOrganizationResponse.profile.logo,
      },
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
    const createTenantResponse = await fetch(
      `${cihUrl}/operator/tenants/create`,
      {
        method: 'POST',
        body: JSON.stringify(createTenantPayload),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPERATOR_API_TOKEN}`,
        },
      },
    );
    expect(createTenantResponse.status).toEqual(200);
    const createTenantJson = await createTenantResponse.json();
    expect(createTenantJson).toEqual({
      tenant: expectedTenant(createTenantPayload.tenant, ids.ethereumAccount),
      keyMetadatas: expectedKeyMetadatas(createTenantPayload.keys),
      requestId: expect.any(String),
    });
    const { tenant } = createTenantJson;
    console.dir({ msg: 'Tenant created', tenant });

    // Service Creation
    const createServicePayload = {
      tenantId: tenant.id,
      service: {
        velocityNetworkServiceId: serviceEndpoints[1].id,
        description: 'issuing service',
        termsUrl: 'http://www.example.com/terms.html',
        authMethods: ['preauth'],
        authMode: 'internal',
        authTokensExpireIn: 100000,
        challengesExpireIn: 10000,
        credentialTypesAvailable: [EDUCATION_DEGREE_CREDENTIAL_TYPE],
        autoCleanPII: false,
      },
    };
    const createServiceResponse = await fetch(
      `${cihUrl}/operator/issuer-services/create`,
      {
        method: 'POST',
        body: JSON.stringify(createServicePayload),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPERATOR_API_TOKEN}`,
        },
      },
    );
    expect(createServiceResponse.status).toEqual(200);
    const createServiceJson = await createServiceResponse.json();
    expect(createServiceJson).toEqual({
      service: expectedEntity(createServicePayload.service),
      requestId: expect.any(String),
    });
    const { service } = createServiceJson;
    console.dir({ msg: 'Issuer service created', service });

    // Depot Creation
    const createDepotPayload = {
      tenantId: tenant.id,
      serviceId: service.id,
      depot: { userReference: 'ABC123' },
    };
    const createDepotResponse = await fetch(
      `${cihUrl}/operator/depots/create`,
      {
        method: 'POST',
        body: JSON.stringify(createDepotPayload),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPERATOR_API_TOKEN}`,
        },
      },
    );
    expect(createDepotResponse.status).toEqual(200);
    const createDepotJson = await createDepotResponse.json();
    expect(createDepotJson).toEqual({
      depot: expectedEntity(createDepotPayload.depot, {
        serviceId: createDepotPayload.serviceId,
      }),
      requestId: expect.any(String),
    });
    const { depot } = createDepotJson;
    console.dir({ msg: 'Depot created', depot });

    // Relying Party Service Creation
    const createRelyingPartyServicePayload = {
      tenantId: tenant.id,
      service: {
        mode: 'single',
        velocityNetworkServiceId: serviceEndpoints[2].id,
        description: 'presentation service',
        termsUrl: 'http://www.example.com/terms.html',
        disclosureRequest: {
          types: [{ type: EDUCATION_DEGREE_CREDENTIAL_TYPE }],
          purpose: 'Verify education degree',
          retentionPeriod: 'P30D',
        },
        authTokensExpireIn: 100000,
      },
    };
    const createRelyingPartyServiceResponse = await fetch(
      `${cihUrl}/operator/relying-party-services/create`,
      {
        method: 'POST',
        body: JSON.stringify(createRelyingPartyServicePayload),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPERATOR_API_TOKEN}`,
        },
      },
    );
    expect(createRelyingPartyServiceResponse.status).toEqual(200);
    const createRelyingPartyServiceJson =
      await createRelyingPartyServiceResponse.json();
    expect(createRelyingPartyServiceJson).toEqual({
      service: expectedEntity(createRelyingPartyServicePayload.service, {
        presentationRequestsExpireIn: 600,
      }),
      requestId: expect.any(String),
    });
    const { service: relyingPartyService } = createRelyingPartyServiceJson;
    console.dir({
      msg: 'Relying party service created',
      service: relyingPartyService,
    });

    // Badge Credential Creation
    const createBadgeCredentialPayload = {
      tenantId: tenant.id,
      depotId: depot.id,
      credential: {
        credentialReference: 'cred1',
        content: buildBadgeCredential(createFullOrganizationResponse),
      },
    };
    const createBadgeCredentialResponse = await fetch(
      `${cihUrl}/operator/credentials/create`,
      {
        method: 'POST',
        body: JSON.stringify(createBadgeCredentialPayload),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPERATOR_API_TOKEN}`,
        },
      },
    );
    expect(createBadgeCredentialResponse.status).toEqual(200);
    const createBadgeCredentialJson =
      await createBadgeCredentialResponse.json();
    expect(createBadgeCredentialJson).toEqual({
      credential: expectedEntity(createBadgeCredentialPayload.credential, {
        depotId: depot.id,
        contentHash: (expectedCredential) =>
          hashOffer(expectedCredential.content),
      }),
      requestId: expect.any(String),
    });
    const { credential: badgeCredential } = createBadgeCredentialJson;
    console.dir({
      msg: 'Badge Credential added',
      credential: badgeCredential,
      content: badgeCredential.content,
    });

    // Rejected Badge Credential Creation
    const createRejectedBadgeCredentialPayload = {
      tenantId: tenant.id,
      depotId: depot.id,
      credential: {
        credentialReference: 'cred-rejected-badge',
        content: buildBadgeCredential(createFullOrganizationResponse, {
          achievementDescription:
            'A declined Velocity Network Board badge for 2022',
          achievementId: 'mailto:declined-conformance@imsglobal.org',
          identityHash: 'declined-conformance@imsglobal.org',
          name: 'Declined Velocity Network Board Member 2022',
        }),
      },
    };
    const createRejectedBadgeCredentialResponse = await fetch(
      `${cihUrl}/operator/credentials/create`,
      {
        method: 'POST',
        body: JSON.stringify(createRejectedBadgeCredentialPayload),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPERATOR_API_TOKEN}`,
        },
      },
    );
    expect(createRejectedBadgeCredentialResponse.status).toEqual(200);
    const createRejectedBadgeCredentialJson =
      await createRejectedBadgeCredentialResponse.json();
    expect(createRejectedBadgeCredentialJson).toEqual({
      credential: expectedEntity(
        createRejectedBadgeCredentialPayload.credential,
        {
          depotId: depot.id,
          contentHash: (expectedCredential) =>
            hashOffer(expectedCredential.content),
        },
      ),
      requestId: expect.any(String),
    });
    const { credential: rejectedBadgeCredential } =
      createRejectedBadgeCredentialJson;
    console.dir({
      msg: 'Rejected badge credential added',
      credential: rejectedBadgeCredential,
      content: rejectedBadgeCredential.content,
    });

    // Education Credential Creation
    const createCredentialPayload = {
      tenantId: tenant.id,
      depotId: depot.id,
      credential: {
        credentialReference: 'cred1',
        content: {
          type: [EDUCATION_DEGREE_CREDENTIAL_TYPE],
          credentialSubject: sampleEducationDegreeGraduation(
            createFullOrganizationResponse,
          ),
        },
      },
    };
    const createCredentialResponse = await fetch(
      `${cihUrl}/operator/credentials/create`,
      {
        method: 'POST',
        body: JSON.stringify(createCredentialPayload),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPERATOR_API_TOKEN}`,
        },
      },
    );
    expect(createCredentialResponse.status).toEqual(200);
    const createCredentialJson = await createCredentialResponse.json();
    expect(createCredentialJson).toEqual({
      credential: expectedEntity(createCredentialPayload.credential, {
        depotId: depot.id,
        'content.credentialSubject.alignment[0].type': 'AlignmentObject',
        'content.credentialSubject.institution.type': 'Organization',
        'content.credentialSubject.institution.place.type': 'Place',
        'content.credentialSubject.school.type': 'Organization',
        'content.credentialSubject.school.place.type': 'Place',
        'content.credentialSubject.recipient.type': 'PersonName',
        'content.credentialSubject.type': 'EducationDegree',
        contentHash: (expectedCredential) =>
          hashOffer(expectedCredential.content),
      }),
      requestId: expect.any(String),
    });
    const { credential } = createCredentialJson;
    console.dir({
      msg: 'Education credential added',
      credential: omit('content', credential),
    });

    // Issue Links Creation
    const issueLinksPayload = {
      tenantId: tenant.id,
      serviceId: service.id,
      depotId: depot.id,
    };
    const issueLinksResponse = await fetch(
      `${cihUrl}/operator/issue-links/refresh`,
      {
        method: 'POST',
        body: JSON.stringify(issueLinksPayload),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPERATOR_API_TOKEN}`,
        },
      },
    );
    const issueLinksJson = await issueLinksResponse.json();
    expect(issueLinksJson).toEqual({
      openidCredentialOffer: expect.any(String),
      vnProtocolLink: `velocity-network-devnet://issue?${expectedSearchParams(
        tenant,
        service,
        depot,
        [EDUCATION_DEGREE_CREDENTIAL_TYPE, 'OpenBadgeCredential'],
        issueLinksJson.preauthCode,
      )}`,
      redirectUrl: `${cihUrl}/app-redirect?deeplink=${encodeURIComponent(
        issueLinksJson.vnProtocolLink,
      )}&openid4vc_uri=${encodeURIComponent(
        issueLinksJson.openidCredentialOffer,
      )}`,
      preauthCode: expect.any(String),
      requestId: expect.any(String),
    });
    console.dir({ msg: 'Issue links refreshed', issueLinksJson });

    // Load redirection page
    const redirectUriResponse = await fetch(issueLinksJson.redirectUrl);
    expect(redirectUriResponse.status).toEqual(200);
    console.dir({ msg: 'Landing page fetched' });

    // Get Credential Manifest
    const credentialManifestUrl = new URL(
      issueLinksJson.vnProtocolLink,
    ).searchParams.get('request_uri');
    const credentialManifestResponse = await fetch(credentialManifestUrl, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const credentialManifestJson = await credentialManifestResponse.json();
    expect(credentialManifestJson).toEqual({
      issuing_request: expect.any(String),
    });
    const key = find(
      ({ purposes }) => purposes.includes(KeyPurposes.EXCHANGES),
      keys,
    );
    const { payload: credentialManifest } = await jwtVerify(
      credentialManifestJson.issuing_request,
      jwkFromSecp256k1Key(key.didDocumentKey.publicKeyMultibase, false),
    );
    expect(credentialManifest).toEqual({
      ...expectedCredentialManifest(profile, tenant, service, [
        EDUCATION_DEGREE_CREDENTIAL_TYPE,
        'OpenBadgeCredential',
      ]),
      exp: expect.any(Number),
      iat: expect.any(Number),
      nbf: expect.any(Number),
      iss: tenant.did,
    });
    console.dir({ msg: 'Credential manifest retrieved', credentialManifest });

    const vendorOriginContext = new URL(
      issueLinksJson.vnProtocolLink,
    ).searchParams.get('vendorOriginContext');
    // Authenticate Holder
    const authenticateHolderResponse = await fetch(
      credentialManifest.metadata.submit_presentation_uri,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exchange_id: credentialManifest.exchange_id,
          jwt_vp: await generatePreauthCodeAuthJwt(
            depot,
            vendorOriginContext,
            holderDid,
            holderKeyPair,
          ),
        }),
      },
    );
    expect(authenticateHolderResponse.status).toEqual(200);
    const authenticateHolderJson = await authenticateHolderResponse.json();
    expect(authenticateHolderJson).toEqual({
      token: expect.any(String),
      exchange: {
        disclosureComplete: true,
        exchangeComplete: false,
        id: credentialManifest.exchange_id,
        type: 'issuer',
      },
    });
    console.dir({ msg: 'Holder authenticated' });

    // Get Offers
    const credentialOffersResponse = await fetch(
      credentialManifest.metadata.check_offers_uri,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${authenticateHolderJson.token}`,
        },
        body: JSON.stringify({
          exchange_id: credentialManifest.exchange_id,
          jwt_vp: await generatePreauthCodeAuthJwt(
            depot,
            issueLinksJson.preauthCode,
            holderDid,
            holderKeyPair,
          ),
        }),
      },
    );
    expect(credentialOffersResponse.status).toEqual(200);
    const credentialOffersJson = await credentialOffersResponse.json();
    const expectedCredentialOffers = map(
      ({ content, id, contentHash }) => ({
        id,
        hash: contentHash,
        issuer: { id: did },
        ...content,
      }),
      [credential, badgeCredential, rejectedBadgeCredential],
    );
    expect(credentialOffersJson).toEqual({
      challenge: expect.any(String),
      offers: expect.arrayContaining(expectedCredentialOffers),
    });
    expect(credentialOffersJson.offers).toHaveLength(
      expectedCredentialOffers.length,
    );
    console.dir({
      msg: 'Offers received',
      offers: credentialOffersJson.offers,
    });

    // Issue Credentials
    const issueCredentialsResponse = await fetch(
      credentialManifest.metadata.finalize_offers_uri,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${authenticateHolderJson.token}`,
        },
        body: JSON.stringify({
          approvedOfferIds: [credential.id, badgeCredential.id],
          rejectedOfferIds: [rejectedBadgeCredential.id],
          proof: await buildProof(
            cihUrl,
            holderDid,
            holderKeyPair,
            credentialOffersJson.challenge,
          ),
        }),
      },
    );

    expect(issueCredentialsResponse.status).toEqual(200);
    const vcs = await issueCredentialsResponse.json();
    console.dir({ msg: 'VCs issued', vcs });
    const decodedVcs = map(jwtDecode, vcs);
    expect(decodedVcs).toEqual([
      jwtVcExpectation({
        tenant,
        issuerService: service,
        credentialId: decodedVcs[0].payload.jti,
        subjectId: holderDid,
        credential,
        credentialTypeMetadata: {
          schemaUrl:
            'http://libserver/schemas/education-degree-graduation-v1.1.schema.json',
          jsonldContext: ['http://libserver/contexts/layer1-v1.1.jsonld.json'],
          defaultSignatureAlgorithm: KeyAlgorithms.ES256,
        },
      }),
      jwtVcExpectation({
        tenant,
        issuerService: service,
        credentialId: decodedVcs[1].payload.jti,
        subjectId: holderDid,
        credential: badgeCredential,
        credentialTypeMetadata: {
          schemaUrl:
            'http://libserver/schemas/open-badge-credential.schema.json',
          jsonldContext: [
            'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json',
          ],
          defaultSignatureAlgorithm: KeyAlgorithms.RS256,
        },
        issuer: {
          id: expect.stringMatching(DID_FORMAT),
          type: ['Profile'],
        },
      }),
    ]);
    const payload = {
      tenantId: tenant.id,
      format: PresentationFormat.JWT_VP,
      presentation: await generatePresentationJwt(
        {
          verifiableCredential: vcs,
          issuer: holderDid,
        },
        holderKeyPair.privateKey,
        `${holderDid}#key`,
      ),
    };
    const presentationVerifyResponse = await fetch(
      `${cihUrl}/operator/presentations/verify`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPERATOR_API_TOKEN}`,
        },
      },
    );
    expect(presentationVerifyResponse.status).toEqual(200);

    await expect(presentationVerifyResponse.json()).resolves.toEqual({
      format: PresentationFormat.JWT_VP,
      presentation: payload.presentation,
      w3cPresentation: jwtDecode(payload.presentation).payload.vp,
      verification: {
        verified: true,
        tamperCheck: CheckResults.PASS,
        credentials: mapWithIndex(
          (decodedVc, i) => ({
            format: CredentialFormat.JWT_VC,
            credential: vcs[i],
            w3cCredential: {
              ...decodedVc.payload.vc,
              issuanceDate: expect.stringMatching(ISO_DATETIME_FORMAT),
            },
            verified: true,
            tamperCheck: CheckResults.PASS,
            trustedIssuerCheck: CheckResults.PASS,
            trustedHolderCheck: CheckResults.PASS,
            revocationCheck: CheckResults.PASS,
            expiryCheck: CheckResults.NOT_APPLICABLE,
          }),
          decodedVcs,
        ),
      },
      requestId: expect.any(String),
    });

    // Presentation Link Creation
    const presentationLinksPayload = {
      tenantId: tenant.id,
      serviceId: relyingPartyService.id,
    };
    const presentationLinksResponse = await fetch(
      `${cihUrl}/operator/presentation-links/refresh`,
      {
        method: 'POST',
        body: JSON.stringify(presentationLinksPayload),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPERATOR_API_TOKEN}`,
        },
      },
    );
    expect(presentationLinksResponse.status).toEqual(200);
    const presentationLinksJson = await presentationLinksResponse.json();
    expect(presentationLinksJson).toEqual({
      redirectUrl: expect.any(String),
      vnProtocolLink: expect.any(String),
      openid4vpProtocolLink: expect.any(String),
      requestId: expect.any(String),
    });
    console.dir({
      msg: 'Presentation links refreshed',
      presentationLinksJson,
    });

    const presentationRequestUrl = new URL(
      presentationLinksJson.vnProtocolLink,
    ).searchParams.get('request_uri');
    const presentationRequestResponse = await fetch(presentationRequestUrl, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    expect(presentationRequestResponse.status).toEqual(200);
    const presentationRequestJson = await presentationRequestResponse.json();
    expect(presentationRequestJson).toEqual({
      presentation_request: expect.any(String),
    });
    const { payload: presentationRequest } = await jwtVerify(
      presentationRequestJson.presentation_request,
      jwkFromSecp256k1Key(key.didDocumentKey.publicKeyMultibase, false),
    );
    expect(presentationRequest).toEqual(
      expect.objectContaining({
        exchange_id: expect.any(String),
        presentation_definition: expect.objectContaining({
          id: expect.any(String),
          input_descriptors: expect.any(Array),
        }),
        metadata: expect.objectContaining({
          submit_presentation_uri: `${cihUrl}${vnUrl(tenant)}/presentation`,
        }),
      }),
    );
    console.dir({ msg: 'Presentation request retrieved', presentationRequest });

    const presentationSubmission = await generatePresentationJwt(
      {
        '@context': 'https://www.w3.org/2018/credentials/v1',
        id: nanoid(),
        verifiableCredential: vcs,
        issuer: holderDid,
        presentation_submission: {
          id: nanoid(),
          definition_id: presentationRequest.presentation_definition.id,
          descriptor_map: mapWithIndex(
            (vc, i) => ({
              id: nanoid(),
              path: `$.verifiableCredential[${i}]`,
              format: 'jwt_vc',
            }),
            vcs,
          ),
        },
      },
      holderKeyPair.privateKey,
      `${holderDid}#key`,
    );
    const presentationSubmissionResponse = await fetch(
      presentationRequest.metadata.submit_presentation_uri,
      {
        method: 'POST',
        body: JSON.stringify({
          exchange_id: presentationRequest.exchange_id,
          jwt_vp: presentationSubmission,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
    expect(presentationSubmissionResponse.status).toEqual(200);
    await expect(presentationSubmissionResponse.json()).resolves.toEqual({
      token: expect.any(String),
      exchange: {
        disclosureComplete: true,
        exchangeComplete: true,
        id: presentationRequest.exchange_id,
        type: 'DISCLOSURE',
      },
    });
    console.dir({ msg: 'Presentation submitted' });

    const webhookEvents = await waitForWebhookEvents(receivedWebhooks, [
      {
        type: NotificationEventTypes.CREDENTIAL_REJECTED,
        resourceId: rejectedBadgeCredential.id,
      },
      {
        type: NotificationEventTypes.CREDENTIAL_ISSUED,
        resourceId: credential.id,
      },
      {
        type: NotificationEventTypes.CREDENTIAL_ISSUED,
        resourceId: badgeCredential.id,
      },
      { type: NotificationEventTypes.PRESENTATION_RECEIVED },
    ]);
    expect(webhookEvents).toEqual([
      expectedWebhookEvent({
        type: NotificationEventTypes.CREDENTIAL_REJECTED,
        tenant,
        service,
        depot,
        resource: { type: 'credential', id: rejectedBadgeCredential.id },
        data: {
          credentialReference: rejectedBadgeCredential.credentialReference,
          credentialTypes: ['OpenBadgeCredential'],
          rejectedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
        },
      }),
      expectedWebhookEvent({
        type: NotificationEventTypes.CREDENTIAL_ISSUED,
        tenant,
        service,
        depot,
        resource: { type: 'credential', id: credential.id },
        data: {
          credentialDid: decodedVcs[0].payload.vc.id,
          credentialReference: credential.credentialReference,
          credentialTypes: [EDUCATION_DEGREE_CREDENTIAL_TYPE],
          digestSRI: expect.any(String),
        },
      }),
      expectedWebhookEvent({
        type: NotificationEventTypes.CREDENTIAL_ISSUED,
        tenant,
        service,
        depot,
        resource: { type: 'credential', id: badgeCredential.id },
        data: {
          credentialDid: decodedVcs[1].payload.vc.id,
          credentialReference: badgeCredential.credentialReference,
          credentialTypes: ['OpenBadgeCredential'],
          digestSRI: expect.any(String),
        },
      }),
      expectedWebhookEvent({
        type: NotificationEventTypes.PRESENTATION_RECEIVED,
        tenant,
        service: relyingPartyService,
        depotId: expect.stringMatching(OBJECT_ID_FORMAT),
        resource: {
          type: 'presentation',
          id: expect.stringMatching(OBJECT_ID_FORMAT),
        },
        data: {
          format: PresentationFormat.JWT_VP,
          verificationStatus: 'received',
        },
      }),
    ]);
  }, 45000);
});

const startWebhookReceiver = (receivedWebhooks) =>
  new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.method !== 'POST' || req.url !== WEBHOOK_RECEIVER_PATH) {
        res.writeHead(404).end();
        return;
      }

      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        const rawBody = Buffer.concat(chunks).toString('utf8');
        receivedWebhooks.push({
          body: JSON.parse(rawBody),
          headers: req.headers,
          rawBody,
        });
        res.writeHead(204).end();
      });
    });

    server.once('error', reject);
    server.listen(WEBHOOK_RECEIVER_PORT, '0.0.0.0', () => {
      server.off('error', reject);
      resolve(server);
    });
  });

const waitForWebhookEvents = async (receivedWebhooks, expectedTypes) => {
  const deadline = Date.now() + 15000;

  return pollForWebhookEvents({ deadline, expectedTypes, receivedWebhooks });
};

const pollForWebhookEvents = async ({
  deadline,
  expectedTypes,
  receivedWebhooks,
}) => {
  const matchingEvents = expectedTypes.map((expectedEvent) =>
    receivedWebhooks.find((webhook) =>
      isExpectedWebhookEvent(webhook, expectedEvent),
    ),
  );

  if (matchingEvents.every(Boolean)) {
    return matchingEvents.map(assertWebhookSignature);
  }

  if (Date.now() < deadline) {
    await wait(250);
    return pollForWebhookEvents({ deadline, expectedTypes, receivedWebhooks });
  }

  throw new Error(
    `Timed out waiting for notification webhooks. Expected ${expectedTypes
      .map(formatExpectedWebhookEvent)
      .join(
        ', ',
      )}; received ${receivedWebhooks.map(({ body }) => body.type).join(', ')}`,
  );
};

const isExpectedWebhookEvent = ({ body }, { type, resourceId }) =>
  body.type === type &&
  (resourceId == null || body.resource?.id === resourceId);

const formatExpectedWebhookEvent = ({ type, resourceId }) =>
  resourceId == null ? type : `${type}:${resourceId}`;

const assertWebhookSignature = (webhook) => {
  const { body, headers, rawBody } = webhook;
  const signatureHeader = headers['verii-signature'];
  const signatureParts = Object.fromEntries(
    signatureHeader.split(',').map((part) => part.split('=')),
  );
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(`${signatureParts.t}.${rawBody}`)
    .digest('hex');

  expect(headers['content-type']).toEqual('application/json');
  expect(headers['verii-event-id']).toEqual(body.id);
  expect(headers['verii-event-type']).toEqual(body.type);
  expect(headers['verii-event-time']).toEqual(body.occurredAt);
  expect(signatureHeader).toEqual(
    expect.stringMatching(/^t=\d+,v1=[a-f0-9]+$/),
  );
  expect(signatureParts.v1).toEqual(expectedSignature);

  return webhook;
};

const expectedWebhookEvent = ({
  type,
  tenant,
  service,
  depot,
  depotId = depot?.id,
  resource,
  data,
}) => ({
  body: expect.objectContaining({
    id: expect.stringMatching(/^evt_/),
    type,
    version: 1,
    occurredAt: expect.stringMatching(ISO_DATETIME_FORMAT),
    tenantId: tenant.id,
    tenantDid: tenant.did,
    serviceId: service.id,
    depotId,
    exchangeId: expect.stringMatching(OBJECT_ID_FORMAT),
    resource,
    data: expect.objectContaining(data),
    links: expect.any(Object),
  }),
  headers: expect.any(Object),
  rawBody: expect.any(String),
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

const expectedTenant = (tenant, primaryAccount) => ({
  id: tenant._id ?? expect.stringMatching(OBJECT_ID_FORMAT),
  createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
  updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
  hostUrl: 'https://localhost:13002',
  primaryAccount,
  ...omit(['_id', 'primaryAccount'], tenant),
});

const expectedKeyMetadatas = map((key) => ({
  ...omit(['key', 'didDocumentKey', 'custodied'], key),
  id: expect.stringMatching(OBJECT_ID_FORMAT),
  createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
  encoding: 'jwk',
}));

const expectedEntity = (payload, overrides) =>
  applyOverrides(
    {
      ...payload,
      id: expect.stringMatching(OBJECT_ID_FORMAT),
      createdAt: expect.stringMatching(ISO_DATETIME_FORMAT),
      updatedAt: expect.stringMatching(ISO_DATETIME_FORMAT),
    },
    overrides,
  );

const expectedSearchParams = (
  tenant,
  service,
  depot,
  credentialTypes,
  preauthCode,
) => {
  let searchParamsString = `request_uri=${encodeURIComponent(
    cihUrl,
  )}%2Fvn-api%2Fr%2F${encodeURIComponent(
    encodeURI(tenant.did),
  )}%2Fget-credential-manifest%3Fid%3D${encodeURIComponent(service.id)}`;
  credentialTypes?.forEach((credentialType) => {
    searchParamsString += `%26credential_types%3D${credentialType}`;
  });
  searchParamsString += `&issuerDid=${encodeURIComponent(tenant.did)}`;
  if (preauthCode != null) {
    searchParamsString += `&vendorOriginContext=${encodeURIComponent(
      `depot:${depot.id}:${preauthCode}`,
    )}`;
  }
  return searchParamsString;
};

const expectedCredentialManifest = (
  profile,
  tenant,
  issuerService,
  credentialTypes,
) => ({
  exchange_id: expect.any(String),
  output_descriptors: map(() => expect.any(Object), credentialTypes),
  issuer: {
    id: tenant.did,
  },
  presentation_definition: expectedPresentationDefinition(issuerService),
  metadata: expectedCredentialManifestMetadata(profile, tenant, issuerService),
});

const expectedPresentationDefinition = (issuerService) => {
  const disclosureRequest = issuerService.disclosureRequest ?? {};

  return {
    id: expect.any(String),
    format: {
      jwt_vp: { alg: ['secp256k1'] },
    },
    name: issuerService.description,
    purpose: disclosureRequest.purpose ?? '',
    input_descriptors: map(() => expect.any(Object), disclosureRequest.types),
    submission_requirements: expectedSubmissionRequirements(
      disclosureRequest.types,
    ),
    ...issuerService.presentationDefinition,
  };
};

const expectedSubmissionRequirements = (types) =>
  types != null
    ? [
        {
          from: 'A',
          min: 1,
          rule: 'all',
        },
      ]
    : [];

const expectedCredentialManifestMetadata = (profile, tenant, issuerService) => {
  const commercialEntity = issuerService.commercialEntity ?? {};
  const disclosureRequest = issuerService.disclosureRequest ?? {};

  return {
    client_name: commercialEntity.name ?? profile.name,
    logo_uri: commercialEntity.logo ?? profile.logo,
    tos_uri: issuerService.termsUrl,
    max_retention_period: disclosureRequest.retentionPeriod ?? '',
    progress_uri: `${cihUrl}${vnUrl(tenant)}/get-exchange-progress`,
    submit_presentation_uri: `${cihUrl}${vnUrl(tenant)}/authenticate`,
    check_offers_uri: `${cihUrl}${vnUrl(tenant)}/credential-offers`,
    finalize_offers_uri: `${cihUrl}${vnUrl(tenant)}/issue-credentials`,
  };
};

const buildProof = async (
  url,
  didJwk,
  keyPair,
  challenge,
  { useKid = true, ...payloadOverrides } = {},
) => {
  const options = {
    jwk: keyPair.publicKey,
    alg: keyPair.publicKey.crv === 'P-256' ? 'ES256' : 'ES256K',
  };
  if (useKid) {
    options.kid = `${didJwk}#0`;
  }
  const jwt = await jwtSign(
    applyOverrides(
      {
        aud: url,
        nonce: challenge,
        iss: didJwk,
      },
      payloadOverrides,
    ),
    keyPair.privateKey,
    options,
  );
  return {
    proof_type: 'jwt',
    jwt,
  };
};

const vnUrl = ({ did }) => `/vn-api/r/${encodeURI(did)}`;

const generatePreauthCodeAuthJwt = (
  depot,
  vendorOriginContext,
  holderDid,
  keyPair,
) => {
  const didJwk = getDidUriFromJwk(keyPair.publicKey);
  const options = {
    issuer: didJwk,
    jti: nanoid(),
    kid: `${didJwk}#0`,
  };
  const payload = {
    id: nanoid(),
    issuer: holderDid,
    vp: {
      presentation_submission: {
        id: nanoid(),
        definition_id: nanoid(),
      },
    },
  };
  if (vendorOriginContext != null) {
    payload.vp.vendorOriginContext = vendorOriginContext;
  }
  return generateDocJwt(payload, keyPair.privateKey, options);
};

const buildBadgeCredential = (
  organization,
  {
    achievementDescription = 'A member of the Velocity Network Board in 2022',
    achievementId = 'mailto:conformance@imsglobal.org',
    identityHash = 'conformance@imsglobal.org',
    name = 'Velocity Network Board Member 2022',
  } = {},
) => ({
  type: ['OpenBadgeCredential'],
  name,
  validFrom: '2022-12-31T00:00:00Z',
  issuer: { type: ['Profile'], id: organization.didDoc.id },
  credentialSchema: [
    {
      id: 'https://purl.imsglobal.org/spec/ob/v3p0/schema/json/ob_v3p0_anyachievementcredential_schema.json',
      type: '1EdTechJsonSchemaValidator2019',
    },
  ],
  credentialSubject: {
    type: ['AchievementSubject'],
    achievement: {
      type: ['Achievement'],
      id: achievementId,
      identifier: {
        type: ['IdentifierEntry'],
        identityType: 'emailAddress',
        identityHash,
      },
      name,
      description: achievementDescription,
      criteria: {
        narrative:
          // eslint-disable-next-line max-len
          'The Velocity Network Board of 2022 governs the Velocity Network Foundation, a non-profit consortium of Human resource and Student management technology providers aiming to empower individual learners and workers by leveraging decentralized digital credentialing technology.',
      },
      image: {
        type: 'Image',
        id: 'https://assets.velocitynetwork.foundation/logos/Badges-VNF-Board-Member-538.png',
      },
    },
  },
});
