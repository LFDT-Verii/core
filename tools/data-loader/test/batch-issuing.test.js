const { env } = require('node:process');
const path = require('path');
const nock = require('nock');
const got = require('got');

const gotExtendSpy = jest.spyOn(got, 'extend');
const { nanoid } = require('nanoid');
const { runBatchIssuing } = require('../src/batch-issuing/orchestrators');

const ISO_DATETIME_TZ_FORMAT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\+\d\d:\d\d|Z)$/;

describe('batch issuing test', () => {
  beforeAll(() => {
    nock.cleanAll();
  });

  afterAll(() => {
    nock.cleanAll();
    nock.restore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should fail if options don't have credential type or type doesn't exist", async () => {
    const options = {
      csvFilename: path.join(__dirname, 'data/batch-vars-offerids.csv'),
      offerTemplateFilename: path.join(
        __dirname,
        'data/email-offer.template.json'
      ),
      tenant: 'foo',
      termsUrl: 'http://example.com/terms.html',
      idCredentialType: 'Mug2.1',
      new: true,
      dryrun: true,
    };

    await expect(() => runBatchIssuing(options)).rejects.toThrowError(
      "Mug2.1 doesn't exist. Please use one of EmailV1.0,PhoneV1.0,DriversLicenseV1.0"
    );
  });
  it("should fail if options doesn't have 'did' or `tenant'", async () => {
    const options = {
      csvFilename: path.join(__dirname, 'data/batch-vars-offerids.csv'),
      offerTemplateFilename: path.join(
        __dirname,
        'data/email-offer.template.json'
      ),
      termsUrl: 'http://example.com/terms.html',
      idCredentialType: 'Mug2.1',
      new: true,
      dryrun: true,
    };

    await expect(() => runBatchIssuing(options)).rejects.toThrowError(
      'one of "--tenant" or "--did" is required'
    );
  });

  it('should load the templates and use offerIds from the csv', async () => {
    const options = {
      csvFilename: path.join(__dirname, 'data/batch-vars-offerids.csv'),
      offerTemplateFilename: path.join(
        __dirname,
        'data/email-offer.template.json'
      ),
      tenant: 'foo',
      termsUrl: 'http://example.com/terms.html',
      new: true,
      dryrun: true,
    };

    const updates = await runBatchIssuing(options);
    expect(
      new Date(updates.disclosureRequest.activationDate).getTime()
    ).toBeLessThan(Date.now());

    expect(updates).toEqual({
      disclosureRequest: {
        configurationType: 'issuing',
        vendorEndpoint: 'integrated-issuing-identification',
        types: [
          {
            type: 'EmailV1.0',
          },
        ],
        identityMatchers: {
          rules: [
            {
              valueIndex: 0,
              path: ['$.emails'],
              rule: 'pick',
            },
          ],
          vendorUserIdIndex: 0,
        },
        vendorDisclosureId: expect.any(Number),
        setIssuingDefault: true,
        duration: '1h', // 1 hour by default
        offerMode: 'preloaded',
        purpose: 'Issuing Career Credential', // by default have a generic message
        activationDate: expect.stringMatching(ISO_DATETIME_TZ_FORMAT),
        termsUrl: 'http://example.com/terms.html',
        authTokenExpiresIn: 525600,
      },
      newExchangeOffers: [
        {
          newOffer: {
            type: ['EmailV1.0'],
            issuer: {
              id: 'did to be determined at runtime',
            },
            credentialSubject: {
              vendorUserId: 'joan.lee@sap.com',
              email: 'joan.lee@sap.com',
            },

            offerId: '100',
          },
          newExchange: {
            type: 'ISSUING',
            identityMatcherValues: ['joan.lee@sap.com'],
          },
        },
        {
          newOffer: {
            type: ['EmailV1.0'],
            issuer: {
              id: 'did to be determined at runtime',
            },
            credentialSubject: {
              vendorUserId: 'john.smith@sap.com',
              email: 'john.smith@sap.com',
            },

            offerId: '200',
          },
          newExchange: {
            type: 'ISSUING',
            identityMatcherValues: ['john.smith@sap.com'],
          },
        },
      ],
    });
  });

  it('should load the templates and use offerIds from the csv using phone for identifier matching using col index', async () => {
    const options = {
      csvFilename: path.join(__dirname, 'data/batch-vars-offerids.csv'),
      offerTemplateFilename: path.join(
        __dirname,
        'data/email-offer.template.json'
      ),
      tenant: 'foo',
      termsUrl: 'http://example.com/terms.html',
      idCredentialType: 'PhoneV1.0',
      identifierMatchColumn: 1,
      new: true,
      dryrun: true,
    };

    const updates = await runBatchIssuing(options);
    expect(
      new Date(updates.disclosureRequest.activationDate).getTime()
    ).toBeLessThan(Date.now());

    expect(updates).toEqual({
      disclosureRequest: {
        configurationType: 'issuing',
        vendorEndpoint: 'integrated-issuing-identification',
        types: [
          {
            type: 'PhoneV1.0',
          },
        ],
        identityMatchers: {
          rules: [
            {
              valueIndex: 1,
              path: ['$.phones'],
              rule: 'pick',
            },
          ],
          vendorUserIdIndex: 0,
        },
        vendorDisclosureId: expect.any(Number),
        setIssuingDefault: true,
        duration: '1h', // 1 hour by default
        offerMode: 'preloaded',
        purpose: 'Issuing Career Credential', // by default have a generic message
        activationDate: expect.stringMatching(ISO_DATETIME_TZ_FORMAT),
        termsUrl: 'http://example.com/terms.html',
        authTokenExpiresIn: 525600,
      },
      newExchangeOffers: [
        {
          newOffer: {
            type: ['EmailV1.0'],
            issuer: {
              id: 'did to be determined at runtime',
            },
            credentialSubject: {
              vendorUserId: 'joan.lee@sap.com',
              email: 'joan.lee@sap.com',
            },
            offerId: '100',
          },
          newExchange: {
            type: 'ISSUING',
            identityMatcherValues: ['+16478275610'],
          },
        },
        {
          newOffer: {
            type: ['EmailV1.0'],
            issuer: {
              id: 'did to be determined at runtime',
            },
            credentialSubject: {
              vendorUserId: 'john.smith@sap.com',
              email: 'john.smith@sap.com',
            },
            offerId: '200',
          },
          newExchange: {
            type: 'ISSUING',
            identityMatcherValues: ['+9711234567'],
          },
        },
      ],
    });
  });

  it('should load the templates and use offerIds from the csv using phone for identifier matching using col name', async () => {
    const options = {
      csvFilename: path.join(__dirname, 'data/batch-vars-offerids.csv'),
      offerTemplateFilename: path.join(
        __dirname,
        'data/email-offer.template.json'
      ),
      tenant: 'foo',
      termsUrl: 'http://example.com/terms.html',
      idCredentialType: 'PhoneV1.0',
      identifierMatchColumn: 'phone',
      new: true,
      dryrun: true,
    };

    const updates = await runBatchIssuing(options);
    expect(
      new Date(updates.disclosureRequest.activationDate).getTime()
    ).toBeLessThan(Date.now());

    expect(updates).toEqual({
      disclosureRequest: {
        configurationType: 'issuing',
        vendorEndpoint: 'integrated-issuing-identification',
        types: [
          {
            type: 'PhoneV1.0',
          },
        ],
        identityMatchers: {
          rules: [
            {
              valueIndex: 1,
              path: ['$.phones'],
              rule: 'pick',
            },
          ],
          vendorUserIdIndex: 0,
        },
        vendorDisclosureId: expect.any(Number),
        setIssuingDefault: true,
        duration: '1h', // 1 hour by default
        offerMode: 'preloaded',
        purpose: 'Issuing Career Credential', // by default have a generic message
        activationDate: expect.stringMatching(ISO_DATETIME_TZ_FORMAT),
        termsUrl: 'http://example.com/terms.html',
        authTokenExpiresIn: 525600,
      },
      newExchangeOffers: [
        {
          newOffer: {
            type: ['EmailV1.0'],
            issuer: {
              id: 'did to be determined at runtime',
            },
            credentialSubject: {
              vendorUserId: 'joan.lee@sap.com',
              email: 'joan.lee@sap.com',
            },
            offerId: '100',
          },
          newExchange: {
            type: 'ISSUING',
            identityMatcherValues: ['+16478275610'],
          },
        },
        {
          newOffer: {
            type: ['EmailV1.0'],
            issuer: {
              id: 'did to be determined at runtime',
            },
            credentialSubject: {
              vendorUserId: 'john.smith@sap.com',
              email: 'john.smith@sap.com',
            },
            offerId: '200',
          },
          newExchange: {
            type: 'ISSUING',
            identityMatcherValues: ['+9711234567'],
          },
        },
      ],
    });
  });

  it('should load the templates and use offerIds from the csv and use phone as the vendorUserId', async () => {
    const options = {
      csvFilename: path.join(__dirname, 'data/batch-vars-offerids.csv'),
      offerTemplateFilename: path.join(
        __dirname,
        'data/email-offer.template.json'
      ),
      tenant: 'foo',
      termsUrl: 'http://example.com/terms.html',
      idCredentialType: 'EmailV1.0',
      vendorUseridColumn: 1,
      new: true,
      dryrun: true,
    };

    const updates = await runBatchIssuing(options);
    expect(
      new Date(updates.disclosureRequest.activationDate).getTime()
    ).toBeLessThan(Date.now());

    expect(updates).toEqual({
      disclosureRequest: {
        configurationType: 'issuing',
        vendorEndpoint: 'integrated-issuing-identification',
        types: [
          {
            type: 'EmailV1.0',
          },
        ],
        identityMatchers: {
          rules: [
            {
              valueIndex: 0,
              path: ['$.emails'],
              rule: 'pick',
            },
          ],
          vendorUserIdIndex: 1,
        },
        vendorDisclosureId: expect.any(Number),
        setIssuingDefault: true,
        duration: '1h', // 1 hour by default
        offerMode: 'preloaded',
        purpose: 'Issuing Career Credential', // by default have a generic message
        activationDate: expect.stringMatching(ISO_DATETIME_TZ_FORMAT),
        termsUrl: 'http://example.com/terms.html',
        authTokenExpiresIn: 525600,
      },
      newExchangeOffers: [
        {
          newOffer: {
            type: ['EmailV1.0'],
            issuer: {
              id: 'did to be determined at runtime',
            },
            credentialSubject: {
              vendorUserId: '+16478275610',
              email: 'joan.lee@sap.com',
            },

            offerId: '100',
          },
          newExchange: {
            type: 'ISSUING',
            identityMatcherValues: ['joan.lee@sap.com'],
          },
        },
        {
          newOffer: {
            type: ['EmailV1.0'],
            issuer: {
              id: 'did to be determined at runtime',
            },
            credentialSubject: {
              vendorUserId: '+9711234567',
              email: 'john.smith@sap.com',
            },

            offerId: '200',
          },
          newExchange: {
            type: 'ISSUING',
            identityMatcherValues: ['john.smith@sap.com'],
          },
        },
      ],
    });
  });
  it('should load the templates and use offerIds by phone from the csv', async () => {
    const options = {
      csvFilename: path.join(__dirname, 'data/phones-batch-vars-offerids.csv'),
      offerTemplateFilename: path.join(
        __dirname,
        'data/phone-offer.template.json'
      ),
      tenant: 'foo',
      termsUrl: 'http://example.com/terms.html',
      idCredentialType: 'PhoneV1.0',
      new: true,
      dryrun: true,
    };

    const updates = await runBatchIssuing(options);
    expect(
      new Date(updates.disclosureRequest.activationDate).getTime()
    ).toBeLessThan(Date.now());

    expect(updates).toEqual({
      disclosureRequest: {
        configurationType: 'issuing',
        vendorEndpoint: 'integrated-issuing-identification',
        types: [
          {
            type: 'PhoneV1.0',
          },
        ],
        identityMatchers: {
          rules: [
            {
              valueIndex: 0,
              path: ['$.phones'],
              rule: 'pick',
            },
          ],
          vendorUserIdIndex: 0,
        },
        vendorDisclosureId: expect.any(Number),
        setIssuingDefault: true,
        duration: '1h', // 1 hour by default
        offerMode: 'preloaded',
        purpose: 'Issuing Career Credential', // by default have a generic message
        activationDate: expect.stringMatching(ISO_DATETIME_TZ_FORMAT),
        termsUrl: 'http://example.com/terms.html',
        authTokenExpiresIn: 525600,
      },
      newExchangeOffers: [
        {
          newOffer: {
            type: ['PhoneV1.0'],
            issuer: {
              id: 'did to be determined at runtime',
            },
            credentialSubject: {
              vendorUserId: '+1234567890',
              phone: '+1234567890',
            },

            offerId: '100',
          },
          newExchange: {
            type: 'ISSUING',
            identityMatcherValues: ['+1234567890'],
          },
        },
        {
          newOffer: {
            type: ['PhoneV1.0'],
            issuer: {
              id: 'did to be determined at runtime',
            },
            credentialSubject: {
              vendorUserId: '+2345678901',
              phone: '+2345678901',
            },

            offerId: '200',
          },
          newExchange: {
            type: 'ISSUING',
            identityMatcherValues: ['+2345678901'],
          },
        },
      ],
    });
  });
  it('should load the templates and use offerIds by driver license from the csv', async () => {
    const options = {
      csvFilename: path.join(__dirname, 'data/driver-license-variables.csv'),
      offerTemplateFilename: path.join(
        __dirname,
        'data/driver-license-offer.template.json'
      ),
      tenant: 'foo',
      termsUrl: 'http://example.com/terms.html',
      idCredentialType: 'DriversLicenseV1.0',
      new: true,
      dryrun: true,
    };

    const updates = await runBatchIssuing(options);
    expect(
      new Date(updates.disclosureRequest.activationDate).getTime()
    ).toBeLessThan(Date.now());

    expect(updates).toEqual({
      disclosureRequest: {
        configurationType: 'issuing',
        vendorEndpoint: 'integrated-issuing-identification',
        types: [
          {
            type: 'DriversLicenseV1.0',
          },
        ],
        identityMatchers: {
          rules: [
            {
              valueIndex: 0,
              path: ['$.idDocumentCredentials[*].credentialSubject.identifier'],
              rule: 'pick',
            },
          ],
          vendorUserIdIndex: 0,
        },
        vendorDisclosureId: expect.any(Number),
        setIssuingDefault: true,
        duration: '1h', // 1 hour by default
        offerMode: 'preloaded',
        purpose: 'Issuing Career Credential', // by default have a generic message
        activationDate: expect.stringMatching(ISO_DATETIME_TZ_FORMAT),
        termsUrl: 'http://example.com/terms.html',
        authTokenExpiresIn: 525600,
      },
      newExchangeOffers: [
        {
          newOffer: {
            type: ['DriversLicenseV1.0'],
            issuer: {
              id: 'did to be determined at runtime',
            },
            credentialSubject: {
              vendorUserId: 'vm123456',
              identifier: 'vm123456',
            },

            offerId: expect.any(String),
          },
          newExchange: {
            type: 'ISSUING',
            identityMatcherValues: ['vm123456'],
          },
        },
        {
          newOffer: {
            type: ['DriversLicenseV1.0'],
            issuer: {
              id: 'did to be determined at runtime',
            },
            credentialSubject: {
              vendorUserId: 'as4523456',
              identifier: 'as4523456',
            },

            offerId: expect.any(String),
          },
          newExchange: {
            type: 'ISSUING',
            identityMatcherValues: ['as4523456'],
          },
        },
      ],
    });
  });

  it('should load the templates and use offerIds by IdDocument from the csv', async () => {
    const options = {
      csvFilename: path.join(__dirname, 'data/id-document-variables.csv'),
      offerTemplateFilename: path.join(
        __dirname,
        'data/id-document-offer.template.json'
      ),
      tenant: 'foo',
      termsUrl: 'http://example.com/terms.html',
      idCredentialType: 'IdDocumentV1.0',
      new: true,
      dryrun: true,
    };

    const updates = await runBatchIssuing(options);
    expect(
      new Date(updates.disclosureRequest.activationDate).getTime()
    ).toBeLessThan(Date.now());

    expect(updates).toEqual({
      disclosureRequest: {
        configurationType: 'issuing',
        vendorEndpoint: 'integrated-issuing-identification',
        types: [
          {
            type: 'IdDocumentV1.0',
          },
        ],
        identityMatchers: {
          rules: [
            {
              valueIndex: 0,
              path: ['$.idDocumentCredentials[*].credentialSubject.identifier'],
              rule: 'pick',
            },
          ],
          vendorUserIdIndex: 0,
        },
        vendorDisclosureId: expect.any(Number),
        setIssuingDefault: true,
        duration: '1h', // 1 hour by default
        offerMode: 'preloaded',
        purpose: 'Issuing Career Credential', // by default have a generic message
        activationDate: expect.stringMatching(ISO_DATETIME_TZ_FORMAT),
        termsUrl: 'http://example.com/terms.html',
        authTokenExpiresIn: 525600,
      },
      newExchangeOffers: [
        {
          newOffer: {
            type: ['IdDocumentV1.0'],
            issuer: {
              id: 'did to be determined at runtime',
            },
            credentialSubject: {
              vendorUserId: 'BR514345',
              identifier: 'BR514345',
            },

            offerId: expect.any(String),
          },
          newExchange: {
            type: 'ISSUING',
            identityMatcherValues: ['BR514345'],
          },
        },
        {
          newOffer: {
            type: ['IdDocumentV1.0'],
            issuer: {
              id: 'did to be determined at runtime',
            },
            credentialSubject: {
              vendorUserId: 'BT678543',
              identifier: 'BT678543',
            },

            offerId: expect.any(String),
          },
          newExchange: {
            type: 'ISSUING',
            identityMatcherValues: ['BT678543'],
          },
        },
      ],
    });
  });

  it('should load the templates and use offerIds by residentPermit from the csv', async () => {
    const options = {
      csvFilename: path.join(__dirname, 'data/resident-permit-variables.csv'),
      offerTemplateFilename: path.join(
        __dirname,
        'data/resident-permit-offer.template.json'
      ),
      tenant: 'foo',
      termsUrl: 'http://example.com/terms.html',
      idCredentialType: 'ResidentPermitV1.0',
      new: true,
      dryrun: true,
    };

    const updates = await runBatchIssuing(options);
    expect(
      new Date(updates.disclosureRequest.activationDate).getTime()
    ).toBeLessThan(Date.now());

    expect(updates).toEqual({
      disclosureRequest: {
        configurationType: 'issuing',
        vendorEndpoint: 'integrated-issuing-identification',
        types: [
          {
            type: 'ResidentPermitV1.0',
          },
        ],
        identityMatchers: {
          rules: [
            {
              valueIndex: 0,
              path: ['$.idDocumentCredentials[*].credentialSubject.identifier'],
              rule: 'pick',
            },
          ],
          vendorUserIdIndex: 0,
        },
        vendorDisclosureId: expect.any(Number),
        setIssuingDefault: true,
        duration: '1h', // 1 hour by default
        offerMode: 'preloaded',
        purpose: 'Issuing Career Credential', // by default have a generic message
        activationDate: expect.stringMatching(ISO_DATETIME_TZ_FORMAT),
        termsUrl: 'http://example.com/terms.html',
        authTokenExpiresIn: 525600,
      },
      newExchangeOffers: [
        {
          newOffer: {
            type: ['ResidentPermitV1.0'],
            issuer: {
              id: 'did to be determined at runtime',
            },
            credentialSubject: {
              vendorUserId: 'ER514345',
              identifier: 'ER514345',
            },

            offerId: expect.any(String),
          },
          newExchange: {
            type: 'ISSUING',
            identityMatcherValues: ['ER514345'],
          },
        },
        {
          newOffer: {
            type: ['ResidentPermitV1.0'],
            issuer: {
              id: 'did to be determined at runtime',
            },
            credentialSubject: {
              vendorUserId: 'RT678543',
              identifier: 'RT678543',
            },

            offerId: expect.any(String),
          },
          newExchange: {
            type: 'ISSUING',
            identityMatcherValues: ['RT678543'],
          },
        },
      ],
    });
  });

  it('should load the templates and use offerIds by passport from the csv', async () => {
    const options = {
      csvFilename: path.join(__dirname, 'data/passport-variables.csv'),
      offerTemplateFilename: path.join(
        __dirname,
        'data/passport-offer.template.json'
      ),
      tenant: 'foo',
      termsUrl: 'http://example.com/terms.html',
      idCredentialType: 'PassportV1.0',
      new: true,
      dryrun: true,
    };

    const updates = await runBatchIssuing(options);
    expect(
      new Date(updates.disclosureRequest.activationDate).getTime()
    ).toBeLessThan(Date.now());

    expect(updates).toEqual({
      disclosureRequest: {
        configurationType: 'issuing',
        vendorEndpoint: 'integrated-issuing-identification',
        types: [
          {
            type: 'PassportV1.0',
          },
        ],
        identityMatchers: {
          rules: [
            {
              valueIndex: 0,
              path: ['$.idDocumentCredentials[*].credentialSubject.identifier'],
              rule: 'pick',
            },
          ],
          vendorUserIdIndex: 0,
        },
        vendorDisclosureId: expect.any(Number),
        setIssuingDefault: true,
        duration: '1h', // 1 hour by default
        offerMode: 'preloaded',
        purpose: 'Issuing Career Credential', // by default have a generic message
        activationDate: expect.stringMatching(ISO_DATETIME_TZ_FORMAT),
        termsUrl: 'http://example.com/terms.html',
        authTokenExpiresIn: 525600,
      },
      newExchangeOffers: [
        {
          newOffer: {
            type: ['PassportV1.0'],
            issuer: {
              id: 'did to be determined at runtime',
            },
            credentialSubject: {
              vendorUserId: 'ER514345',
              identifier: 'ER514345',
            },

            offerId: expect.any(String),
          },
          newExchange: {
            type: 'ISSUING',
            identityMatcherValues: ['ER514345'],
          },
        },
        {
          newOffer: {
            type: ['PassportV1.0'],
            issuer: {
              id: 'did to be determined at runtime',
            },
            credentialSubject: {
              vendorUserId: 'RT678543',
              identifier: 'RT678543',
            },

            offerId: expect.any(String),
          },
          newExchange: {
            type: 'ISSUING',
            identityMatcherValues: ['RT678543'],
          },
        },
      ],
    });
  });

  it('should load the templates and use offerIds by NationalIdCard from the csv', async () => {
    const options = {
      csvFilename: path.join(__dirname, 'data/national-id-card-variables.csv'),
      offerTemplateFilename: path.join(
        __dirname,
        'data/national-id-card-offer.template.json'
      ),
      tenant: 'foo',
      termsUrl: 'http://example.com/terms.html',
      idCredentialType: 'NationalIdCardV1.0',
      new: true,
      dryrun: true,
    };

    const updates = await runBatchIssuing(options);
    expect(
      new Date(updates.disclosureRequest.activationDate).getTime()
    ).toBeLessThan(Date.now());

    expect(updates).toEqual({
      disclosureRequest: {
        configurationType: 'issuing',
        vendorEndpoint: 'integrated-issuing-identification',
        types: [
          {
            type: 'NationalIdCardV1.0',
          },
        ],
        identityMatchers: {
          rules: [
            {
              valueIndex: 0,
              path: ['$.idDocumentCredentials[*].credentialSubject.identifier'],
              rule: 'pick',
            },
          ],
          vendorUserIdIndex: 0,
        },
        vendorDisclosureId: expect.any(Number),
        setIssuingDefault: true,
        duration: '1h', // 1 hour by default
        offerMode: 'preloaded',
        purpose: 'Issuing Career Credential', // by default have a generic message
        activationDate: expect.stringMatching(ISO_DATETIME_TZ_FORMAT),
        termsUrl: 'http://example.com/terms.html',
        authTokenExpiresIn: 525600,
      },
      newExchangeOffers: [
        {
          newOffer: {
            type: ['NationalIdCardV1.0'],
            issuer: {
              id: 'did to be determined at runtime',
            },
            credentialSubject: {
              vendorUserId: 'BR514345',
              identifier: 'BR514345',
            },

            offerId: expect.any(String),
          },
          newExchange: {
            type: 'ISSUING',
            identityMatcherValues: ['BR514345'],
          },
        },
        {
          newOffer: {
            type: ['NationalIdCardV1.0'],
            issuer: {
              id: 'did to be determined at runtime',
            },
            credentialSubject: {
              vendorUserId: 'BT678543',
              identifier: 'BT678543',
            },

            offerId: expect.any(String),
          },
          newExchange: {
            type: 'ISSUING',
            identityMatcherValues: ['BT678543'],
          },
        },
      ],
    });
  });

  it('should load the templates and use offerIds by ProofOfAge from the csv', async () => {
    const options = {
      csvFilename: path.join(__dirname, 'data/proof-of-age-variables.csv'),
      offerTemplateFilename: path.join(
        __dirname,
        'data/proof-of-age-offer.template.json'
      ),
      tenant: 'foo',
      termsUrl: 'http://example.com/terms.html',
      idCredentialType: 'ProofOfAgeV1.0',
      new: true,
      dryrun: true,
    };

    const updates = await runBatchIssuing(options);
    expect(
      new Date(updates.disclosureRequest.activationDate).getTime()
    ).toBeLessThan(Date.now());

    expect(updates).toEqual({
      disclosureRequest: {
        configurationType: 'issuing',
        vendorEndpoint: 'integrated-issuing-identification',
        types: [
          {
            type: 'ProofOfAgeV1.0',
          },
        ],
        identityMatchers: {
          rules: [
            {
              valueIndex: 0,
              path: ['$.idDocumentCredentials[*].credentialSubject.identifier'],
              rule: 'pick',
            },
          ],
          vendorUserIdIndex: 0,
        },
        vendorDisclosureId: expect.any(Number),
        setIssuingDefault: true,
        duration: '1h', // 1 hour by default
        offerMode: 'preloaded',
        purpose: 'Issuing Career Credential', // by default have a generic message
        activationDate: expect.stringMatching(ISO_DATETIME_TZ_FORMAT),
        termsUrl: 'http://example.com/terms.html',
        authTokenExpiresIn: 525600,
      },
      newExchangeOffers: [
        {
          newOffer: {
            type: ['ProofOfAgeV1.0'],
            issuer: {
              id: 'did to be determined at runtime',
            },
            credentialSubject: {
              vendorUserId: 'ER514345',
              identifier: 'ER514345',
            },

            offerId: expect.any(String),
          },
          newExchange: {
            type: 'ISSUING',
            identityMatcherValues: ['ER514345'],
          },
        },
        {
          newOffer: {
            type: ['ProofOfAgeV1.0'],
            issuer: {
              id: 'did to be determined at runtime',
            },
            credentialSubject: {
              vendorUserId: 'RT678543',
              identifier: 'RT678543',
            },

            offerId: expect.any(String),
          },
          newExchange: {
            type: 'ISSUING',
            identityMatcherValues: ['RT678543'],
          },
        },
      ],
    });
  });

  it('should load the templates and csv', async () => {
    const options = {
      csvFilename: path.join(__dirname, 'data/variables.csv'),
      offerTemplateFilename: path.join(
        __dirname,
        'data/email-offer.template.json'
      ),
      tenant: 'foo',
      termsUrl: 'http://example.com/terms.html',
      idCredentialType: 'EmailV1.0',
      vendorUseridColumn: 'email',
      new: true,
      dryrun: true,
    };

    const updates = await runBatchIssuing(options);
    expect(
      new Date(updates.disclosureRequest.activationDate).getTime()
    ).toBeLessThan(Date.now());

    expect(updates).toEqual({
      disclosureRequest: {
        configurationType: 'issuing',
        vendorEndpoint: 'integrated-issuing-identification',
        types: [
          {
            type: 'EmailV1.0',
          },
        ],
        identityMatchers: {
          rules: [
            {
              valueIndex: 0,
              path: ['$.emails'],
              rule: 'pick',
            },
          ],
          vendorUserIdIndex: 2,
        },
        vendorDisclosureId: expect.any(Number),
        setIssuingDefault: true,
        duration: '1h', // 1 hour by default
        offerMode: 'preloaded',
        purpose: 'Issuing Career Credential', // by default have a generic message
        activationDate: expect.stringMatching(ISO_DATETIME_TZ_FORMAT),
        termsUrl: 'http://example.com/terms.html',
        authTokenExpiresIn: 525600,
      },
      newExchangeOffers: [
        {
          newOffer: {
            type: ['EmailV1.0'],
            issuer: {
              id: 'did to be determined at runtime',
            },
            credentialSubject: {
              vendorUserId: 'joan.lee@sap.com',
              email: 'joan.lee@sap.com',
            },

            offerId: expect.any(String),
          },
          newExchange: {
            type: 'ISSUING',
            identityMatcherValues: ['joan.lee@sap.com'],
          },
        },
        {
          newOffer: {
            type: ['EmailV1.0'],
            issuer: {
              id: 'did to be determined at runtime',
            },
            credentialSubject: {
              vendorUserId: 'john.smith@sap.com',
              email: 'john.smith@sap.com',
            },

            offerId: expect.any(String),
          },
          newExchange: {
            type: 'ISSUING',
            identityMatcherValues: ['john.smith@sap.com'],
          },
        },
      ],
    });
  });

  it('should handle csv with BOM characters', async () => {
    const options = {
      csvFilename: path.join(__dirname, 'data/with-bom.csv'),
      offerTemplateFilename: path.join(
        __dirname,
        'data/email-offer.template.json'
      ),
      tenant: 'foo',
      termsUrl: 'http://example.com/terms.html',
      idCredentialType: 'EmailV1.0',
      vendorUseridColumn: 'email',
      new: true,
      dryrun: true,
    };

    const updates = await runBatchIssuing(options);
    expect(
      new Date(updates.disclosureRequest.activationDate).getTime()
    ).toBeLessThan(Date.now());

    expect(updates).toEqual({
      disclosureRequest: {
        configurationType: 'issuing',
        vendorEndpoint: 'integrated-issuing-identification',
        types: [
          {
            type: 'EmailV1.0',
          },
        ],
        identityMatchers: {
          rules: [
            {
              valueIndex: 0,
              path: ['$.emails'],
              rule: 'pick',
            },
          ],
          vendorUserIdIndex: 2,
        },
        vendorDisclosureId: expect.any(Number),
        setIssuingDefault: true,
        duration: '1h', // 1 hour by default
        offerMode: 'preloaded',
        purpose: 'Issuing Career Credential', // by default have a generic message
        activationDate: expect.stringMatching(ISO_DATETIME_TZ_FORMAT),
        termsUrl: 'http://example.com/terms.html',
        authTokenExpiresIn: 525600,
      },
      newExchangeOffers: [
        {
          newOffer: {
            type: ['EmailV1.0'],
            issuer: {
              id: 'did to be determined at runtime',
            },
            credentialSubject: {
              vendorUserId: 'joan.lee@sap.com',
              email: 'joan.lee@sap.com',
            },

            offerId: expect.any(String),
          },
          newExchange: {
            type: 'ISSUING',
            identityMatcherValues: ['joan.lee@sap.com'],
          },
        },
        {
          newOffer: {
            type: ['EmailV1.0'],
            issuer: {
              id: 'did to be determined at runtime',
            },
            credentialSubject: {
              vendorUserId: 'john.smith@sap.com',
              email: 'john.smith@sap.com',
            },

            offerId: expect.any(String),
          },
          newExchange: {
            type: 'ISSUING',
            identityMatcherValues: ['john.smith@sap.com'],
          },
        },
      ],
    });
  });

  it('should load the templates and csv with vars', async () => {
    const options = {
      csvFilename: path.join(__dirname, 'data/variables.csv'),
      offerTemplateFilename: path.join(
        __dirname,
        'data/email-offer.template.json'
      ),
      tenant: 'foo',
      termsUrl: 'http://example.com/terms.html',
      label: 'testLabel',
      offerMode: 'preloaded',
      purpose: 'Some Purpose',
      expiresInHours: 100,
      activatesInHours: 10,
      idCredentialType: 'EmailV1.0',
      vendorUseridColumn: 'email',
      new: true,
      dryrun: true,
    };

    const updates = await runBatchIssuing(options);

    expect(updates).toEqual({
      disclosureRequest: {
        configurationType: 'issuing',
        vendorEndpoint: 'integrated-issuing-identification',
        types: [
          {
            type: 'EmailV1.0',
          },
        ],
        identityMatchers: {
          rules: [
            {
              valueIndex: 0,
              path: ['$.emails'],
              rule: 'pick',
            },
          ],
          vendorUserIdIndex: 2,
        },
        vendorDisclosureId: expect.any(Number),
        setIssuingDefault: true,
        duration: '1h', // 1 hour by default
        offerMode: 'preloaded',
        purpose: options.purpose, // by default have a generic message
        activationDate: expect.stringMatching(ISO_DATETIME_TZ_FORMAT),
        termsUrl: 'http://example.com/terms.html',
        label: options.label,
        authTokenExpiresIn: 525600,
      },
      newExchangeOffers: [
        {
          newOffer: {
            type: ['EmailV1.0'],
            issuer: {
              id: 'did to be determined at runtime',
            },
            credentialSubject: {
              vendorUserId: 'joan.lee@sap.com',
              email: 'joan.lee@sap.com',
            },

            offerId: expect.any(String),
            label: options.label,
          },
          newExchange: {
            type: 'ISSUING',
            identityMatcherValues: ['joan.lee@sap.com'],
            label: options.label,
          },
        },
        {
          newOffer: {
            type: ['EmailV1.0'],
            issuer: {
              id: 'did to be determined at runtime',
            },
            credentialSubject: {
              vendorUserId: 'john.smith@sap.com',
              email: 'john.smith@sap.com',
            },

            offerId: expect.any(String),
            label: options.label,
          },
          newExchange: {
            type: 'ISSUING',
            identityMatcherValues: ['john.smith@sap.com'],
            label: options.label,
          },
        },
      ],
    });

    expect(
      new Date(updates.disclosureRequest.activationDate).getTime()
    ).toBeGreaterThan(Date.now());
  });

  describe('existing disclosure endpoints', () => {
    const existingDisclosures = [{ id: nanoid() }, { id: nanoid() }];

    it('should have error if the disclosureRequest is not found', async () => {
      const agentUrl = 'https://exampleUrl';
      const tenant = '123';
      nock(agentUrl)
        .get(
          `/operator-api/v0.8/tenants/${tenant}/disclosures?vendorEndpoint=integrated-issuing-identification`
        )
        .reply(200, existingDisclosures);

      const options = {
        csvFilename: path.join(__dirname, 'data/variables.csv'),
        offerTemplateFilename: path.join(
          __dirname,
          'data/email-offer.template.json'
        ),
        tenant,
        termsUrl: 'http://example.com/terms.html',
        idCredentialType: 'EmailV1.0',
        disclosure: 'foo',
        dryrun: true,
        endpoint: agentUrl,
        authToken: 'fakeToken',
      };

      await expect(() => runBatchIssuing(options)).rejects.toThrowError();
    });

    it("should find the existing disclosure disclosureRequest with 'tenant' option", async () => {
      const agentUrl = 'https://exampleUrl';
      const tenant = '123';
      nock(agentUrl)
        .get(
          `/operator-api/v0.8/tenants/${tenant}/disclosures?vendorEndpoint=integrated-issuing-identification`
        )
        .reply(200, existingDisclosures);

      const options = {
        csvFilename: path.join(__dirname, 'data/variables.csv'),
        offerTemplateFilename: path.join(
          __dirname,
          'data/email-offer.template.json'
        ),
        tenant,
        termsUrl: 'http://example.com/terms.html',
        idCredentialType: 'EmailV1.0',
        vendorUseridColumn: 'email',
        disclosure: existingDisclosures[0].id,
        dryrun: true,
        endpoint: agentUrl,
        authToken: 'fakeToken',
      };

      const updates = await runBatchIssuing(options);
      expect(updates).toEqual({
        disclosureRequest: existingDisclosures[0],
        newExchangeOffers: [
          {
            newOffer: {
              type: ['EmailV1.0'],
              issuer: {
                id: 'did to be determined at runtime',
              },
              credentialSubject: {
                vendorUserId: 'joan.lee@sap.com',
                email: 'joan.lee@sap.com',
              },

              offerId: expect.any(String),
            },
            newExchange: {
              type: 'ISSUING',
              identityMatcherValues: ['joan.lee@sap.com'],
            },
          },
          {
            newOffer: {
              type: ['EmailV1.0'],
              issuer: {
                id: 'did to be determined at runtime',
              },
              credentialSubject: {
                vendorUserId: 'john.smith@sap.com',
                email: 'john.smith@sap.com',
              },

              offerId: expect.any(String),
            },
            newExchange: {
              type: 'ISSUING',
              identityMatcherValues: ['john.smith@sap.com'],
            },
          },
        ],
      });
    });
    it("should find the existing disclosure disclosureRequest with 'did' option", async () => {
      const agentUrl = 'https://exampleUrl';
      const did = 'did:sap:123';
      nock(agentUrl)
        .get(
          `/operator-api/v0.8/tenants/${did}/disclosures?vendorEndpoint=integrated-issuing-identification`
        )
        .reply(200, existingDisclosures);

      const options = {
        csvFilename: path.join(__dirname, 'data/variables.csv'),
        offerTemplateFilename: path.join(
          __dirname,
          'data/email-offer.template.json'
        ),
        did,
        termsUrl: 'http://example.com/terms.html',
        idCredentialType: 'EmailV1.0',
        vendorUseridColumn: 'email',
        disclosure: existingDisclosures[0].id,
        dryrun: true,
        endpoint: agentUrl,
        authToken: 'fakeToken',
      };

      const updates = await runBatchIssuing(options);
      expect(updates).toEqual({
        disclosureRequest: existingDisclosures[0],
        newExchangeOffers: [
          {
            newOffer: {
              type: ['EmailV1.0'],
              issuer: {
                id: did,
              },
              credentialSubject: {
                vendorUserId: 'joan.lee@sap.com',
                email: 'joan.lee@sap.com',
              },

              offerId: expect.any(String),
            },
            newExchange: {
              type: 'ISSUING',
              identityMatcherValues: ['joan.lee@sap.com'],
            },
          },
          {
            newOffer: {
              type: ['EmailV1.0'],
              issuer: {
                id: did,
              },
              credentialSubject: {
                vendorUserId: 'john.smith@sap.com',
                email: 'john.smith@sap.com',
              },

              offerId: expect.any(String),
            },
            newExchange: {
              type: 'ISSUING',
              identityMatcherValues: ['john.smith@sap.com'],
            },
          },
        ],
      });
    });
  });

  describe('https.rejectUnauthorized test suite', () => {
    beforeEach(() => {
      env.NODE_TLS_REJECT_UNAUTHORIZED = '';
    });
    afterAll(() => {
      env.NODE_TLS_REJECT_UNAUTHORIZED = '';
    });

    it('when NODE_TLS_REJECT_UNAUTHORIZED is "0", got client should be setup with https.rejectUnauthorized false', async () => {
      env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      const options = {
        csvFilename: path.join(__dirname, 'data/batch-vars-offerids.csv'),
        offerTemplateFilename: path.join(
          __dirname,
          'data/email-offer.template.json'
        ),
        tenant: 'foo',
        termsUrl: 'http://example.com/terms.html',
        new: true,
        dryrun: true,
      };
      await runBatchIssuing(options);
      expect(gotExtendSpy.mock.calls).toEqual([
        [{ https: { rejectUnauthorized: false } }],
      ]);
    });

    it('when NODE_TLS_REJECT_UNAUTHORIZED is value other than "0", got client should be setup without https.rejectUnauthorized', async () => {
      const options = {
        csvFilename: path.join(__dirname, 'data/batch-vars-offerids.csv'),
        offerTemplateFilename: path.join(
          __dirname,
          'data/email-offer.template.json'
        ),
        tenant: 'foo',
        termsUrl: 'http://example.com/terms.html',
        new: true,
        dryrun: true,
      };
      env.NODE_TLS_REJECT_UNAUTHORIZED = 'false';
      await runBatchIssuing(options);
      env.NODE_TLS_REJECT_UNAUTHORIZED = '';
      await runBatchIssuing(options);
      env.NODE_TLS_REJECT_UNAUTHORIZED = 'undefined';
      await runBatchIssuing(options);
      delete env.NODE_TLS_REJECT_UNAUTHORIZED;
      await runBatchIssuing(options);
      expect(gotExtendSpy.mock.calls).toEqual([[{}], [{}], [{}], [{}]]);
    });
  });
});
