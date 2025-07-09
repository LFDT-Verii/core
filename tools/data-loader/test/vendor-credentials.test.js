const path = require('path');
const {
  executeVendorCredentials,
} = require('../src/vendor-credentials/orchestrator');

describe('vendor credentials test', () => {
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
});
