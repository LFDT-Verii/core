const { register } = require('@spencejs/spence-factories');
const initOffersRepo = require('../../src/controllers/api/offers/repo');

module.exports = (app) =>
  register(
    'offer',
    initOffersRepo(app)({ config: app.config }),
    async (overrides) => {
      return {
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
        ...overrides(),
      };
    }
  );
