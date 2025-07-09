const { register } = require('@spencejs/spence-factories');
const { nanoid } = require('nanoid');
const initIssuingExchangesRepo = require('../../src/controllers/api/issuing-exchanges/repo');

module.exports = (app) =>
  register(
    'issuingExchanges',
    initIssuingExchangesRepo(app)({ config: app.config }),
    async (overrides) => {
      return {
        exchangeId: nanoid(),
        vendorUserId: 'adam.smith@example.com',
        issuer: { id: 'did:velocity:issuer' },
        ...overrides(),
      };
    }
  );
