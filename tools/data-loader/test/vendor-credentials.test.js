const { after, before, describe, it } = require('node:test');
const { expect } = require('expect');
const nock = require('nock');

const path = require('path');
const {
  executeVendorCredentials,
} = require('../src/vendor-credentials/orchestrator');

describe('vendor credentials test', () => {
  before(() => {
    nock.cleanAll();
  });

  after(() => {
    nock.cleanAll();
    nock.restore();
  });

  it('should load the templates and csv', async () => {
    const options = {
      csvFilename: path.join(__dirname, 'data/variables.csv'),
      offerTemplateFilename: path.join(__dirname, 'data/offer.template.json'),
      personTemplateFilename: path.join(__dirname, 'data/person.template.json'),
    };

    const updates = await executeVendorCredentials(options);

    expect(updates).toEqual([
      {
        offer: {
          type: ['OpenBadgeV1.0'],
          issuer: {
            id: 'did:ion:sap123',
          },
          credentialSubject: {
            vendorUserId: 'joan.lee@sap.com',
            holds: {
              name: 'SAP Sapphire Attendance',
              description:
                'Digital Badge for the Conference Attendees of SAPs Sapphire Conference',
              type: 'BadgeClass',
              issuer: {
                type: 'Profile',
                id: 'did:ion:sap123',
                name: 'SAP',
                uri: 'https://sap.com',
              },
              image: 'https://example.com/badge-image.png',
              criteria: 'https://example.com/sap/criteria.html',
            },
          },
        },
        person: {
          emails: [{ email: 'joan.lee@sap.com' }],
          firstName: { localized: { en: 'Joan' } },
          lastName: { localized: { en: 'Lee' } },
        },
      },
      {
        offer: {
          type: ['OpenBadgeV1.0'],
          issuer: {
            id: 'did:ion:sap123',
          },
          credentialSubject: {
            vendorUserId: 'john.smith@sap.com',
            holds: {
              name: 'SAP Sapphire Attendance',
              description:
                'Digital Badge for the Conference Attendees of SAPs Sapphire Conference',
              type: 'BadgeClass',
              issuer: {
                type: 'Profile',
                id: 'did:ion:sap123',
                name: 'SAP',
                uri: 'https://sap.com',
              },
              image: 'https://example.com/badge-image.png',
              criteria: 'https://example.com/sap/criteria.html',
            },
          },
        },
        person: {
          emails: [{ email: 'john.smith@sap.com' }],
          firstName: { localized: { en: 'John' } },
          lastName: { localized: { en: 'Smith' } },
        },
      },
    ]);
  });

  it('should load the templates and csv and accept a override value for did', async () => {
    const options = {
      csvFilename: path.join(__dirname, 'data/variables-no-did.csv'),
      offerTemplateFilename: path.join(__dirname, 'data/offer.template.json'),
      personTemplateFilename: path.join(__dirname, 'data/person.template.json'),
      vars: { did: 'did:ion:default' },
    };

    const updates = await executeVendorCredentials(options);

    expect(updates).toEqual([
      {
        offer: {
          type: ['OpenBadgeV1.0'],
          issuer: {
            id: 'did:ion:default',
          },
          credentialSubject: {
            vendorUserId: 'joan.lee@sap.com',
            holds: {
              name: 'SAP Sapphire Attendance',
              description:
                'Digital Badge for the Conference Attendees of SAPs Sapphire Conference',
              type: 'BadgeClass',
              issuer: {
                type: 'Profile',
                id: 'did:ion:default',
                name: 'SAP',
                uri: 'https://sap.com',
              },
              image: 'https://example.com/badge-image.png',
              criteria: 'https://example.com/sap/criteria.html',
            },
          },
        },
        person: {
          emails: [{ email: 'joan.lee@sap.com' }],
          firstName: { localized: { en: 'Joan' } },
          lastName: { localized: { en: 'Lee' } },
        },
      },
      {
        offer: {
          type: ['OpenBadgeV1.0'],
          issuer: {
            id: 'did:ion:default',
          },
          credentialSubject: {
            vendorUserId: 'john.smith@sap.com',
            holds: {
              name: 'SAP Sapphire Attendance',
              description:
                'Digital Badge for the Conference Attendees of SAPs Sapphire Conference',
              type: 'BadgeClass',
              issuer: {
                type: 'Profile',
                id: 'did:ion:default',
                name: 'SAP',
                uri: 'https://sap.com',
              },
              image: 'https://example.com/badge-image.png',
              criteria: 'https://example.com/sap/criteria.html',
            },
          },
        },
        person: {
          emails: [{ email: 'john.smith@sap.com' }],
          firstName: { localized: { en: 'John' } },
          lastName: { localized: { en: 'Smith' } },
        },
      },
    ]);
  });

  it('should load the templates and csv and always accept an override value for did', async () => {
    const options = {
      csvFilename: path.join(__dirname, 'data/variables.csv'),
      offerTemplateFilename: path.join(__dirname, 'data/offer.template.json'),
      personTemplateFilename: path.join(__dirname, 'data/person.template.json'),
      vars: { did: 'did:ion:default' },
    };

    const updates = await executeVendorCredentials(options);

    expect(updates).toEqual([
      {
        offer: {
          type: ['OpenBadgeV1.0'],
          issuer: {
            id: 'did:ion:default',
          },
          credentialSubject: {
            vendorUserId: 'joan.lee@sap.com',
            holds: {
              name: 'SAP Sapphire Attendance',
              description:
                'Digital Badge for the Conference Attendees of SAPs Sapphire Conference',
              type: 'BadgeClass',
              issuer: {
                type: 'Profile',
                id: 'did:ion:default',
                name: 'SAP',
                uri: 'https://sap.com',
              },
              image: 'https://example.com/badge-image.png',
              criteria: 'https://example.com/sap/criteria.html',
            },
          },
        },
        person: {
          emails: [{ email: 'joan.lee@sap.com' }],
          firstName: { localized: { en: 'Joan' } },
          lastName: { localized: { en: 'Lee' } },
        },
      },
      {
        offer: {
          type: ['OpenBadgeV1.0'],
          issuer: {
            id: 'did:ion:default',
          },
          credentialSubject: {
            vendorUserId: 'john.smith@sap.com',
            holds: {
              name: 'SAP Sapphire Attendance',
              description:
                'Digital Badge for the Conference Attendees of SAPs Sapphire Conference',
              type: 'BadgeClass',
              issuer: {
                type: 'Profile',
                id: 'did:ion:default',
                name: 'SAP',
                uri: 'https://sap.com',
              },
              image: 'https://example.com/badge-image.png',
              criteria: 'https://example.com/sap/criteria.html',
            },
          },
        },
        person: {
          emails: [{ email: 'john.smith@sap.com' }],
          firstName: { localized: { en: 'John' } },
          lastName: { localized: { en: 'Smith' } },
        },
      },
    ]);
  });

  it('should post prepared person and offer payloads when endpoint is provided', async () => {
    const endpoint = 'https://vendor.example';
    const firstPerson = {
      emails: [{ email: 'joan.lee@sap.com' }],
      firstName: { localized: { en: 'Joan' } },
      lastName: { localized: { en: 'Lee' } },
    };
    const secondPerson = {
      emails: [{ email: 'john.smith@sap.com' }],
      firstName: { localized: { en: 'John' } },
      lastName: { localized: { en: 'Smith' } },
    };
    const firstOffer = {
      type: ['OpenBadgeV1.0'],
      issuer: {
        id: 'did:ion:sap123',
      },
      credentialSubject: {
        vendorUserId: 'joan.lee@sap.com',
        holds: {
          name: 'SAP Sapphire Attendance',
          description:
            'Digital Badge for the Conference Attendees of SAPs Sapphire Conference',
          type: 'BadgeClass',
          issuer: {
            type: 'Profile',
            id: 'did:ion:sap123',
            name: 'SAP',
            uri: 'https://sap.com',
          },
          image: 'https://example.com/badge-image.png',
          criteria: 'https://example.com/sap/criteria.html',
        },
      },
    };
    const secondOffer = {
      type: ['OpenBadgeV1.0'],
      issuer: {
        id: 'did:ion:sap123',
      },
      credentialSubject: {
        vendorUserId: 'john.smith@sap.com',
        holds: {
          name: 'SAP Sapphire Attendance',
          description:
            'Digital Badge for the Conference Attendees of SAPs Sapphire Conference',
          type: 'BadgeClass',
          issuer: {
            type: 'Profile',
            id: 'did:ion:sap123',
            name: 'SAP',
            uri: 'https://sap.com',
          },
          image: 'https://example.com/badge-image.png',
          criteria: 'https://example.com/sap/criteria.html',
        },
      },
    };

    const scope = nock(endpoint, {
      reqheaders: { Authorization: 'Bearer fakeToken' },
    })
      .post('/api/users', firstPerson)
      .reply(200, { id: 'person-id-1' })
      .post('/api/offers', firstOffer)
      .reply(200, { id: 'offer-id-1' })
      .post('/api/users', secondPerson)
      .reply(200, { id: 'person-id-2' })
      .post('/api/offers', secondOffer)
      .reply(200, { id: 'offer-id-2' });

    const options = {
      csvFilename: path.join(__dirname, 'data/variables.csv'),
      offerTemplateFilename: path.join(__dirname, 'data/offer.template.json'),
      personTemplateFilename: path.join(__dirname, 'data/person.template.json'),
      endpoint,
      authToken: 'fakeToken',
    };

    await expect(executeVendorCredentials(options)).resolves.toBeUndefined();

    scope.done();
  });
});
