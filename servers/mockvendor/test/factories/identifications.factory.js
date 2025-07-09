const { register } = require('@spencejs/spence-factories');
const { ObjectId } = require('mongodb');
const initIdentificationsRepo = require('../../src/controllers/api/identifications/repo');

module.exports = (app) =>
  register(
    'identification',
    initIdentificationsRepo(app)({ config: app.config }),
    async (overrides) => {
      return {
        identification: {
          emailCredentials: [
            {
              credentialSubject: {
                email: 'adam.smith@example.com',
              },
              credentialType: 'EmailV1.0',
              issuer: 'did:velocity:0x0b154da48d0f213c26c4b1d040dc5ff1dbf99ffa',
              issuanceDate: new Date(),
              validFrom: new Date(),
            },
          ],
          idDocumentCredentials: [],
          phoneCredentials: [],
          emails: ['adam.smith@example.com'],
          phones: [],
          tenantDID: `did:ion:${new ObjectId()}`,
          exchangeId: new ObjectId(),
        },
        ...overrides(),
      };
    }
  );
