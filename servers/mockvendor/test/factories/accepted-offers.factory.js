const { register } = require('@spencejs/spence-factories');
const { nanoid } = require('nanoid');
const initAcceptedOffersRepo = require('../../src/controllers/api/accepted-offers/repo');

module.exports = (app) =>
  register(
    'acceptedOffers',
    initAcceptedOffersRepo(app)({ config: app.config }),
    async (overrides) => {
      return {
        exchangeId: nanoid(),
        offerIds: ['5539e308-6f2f-4d01-b946-5ca4ba7fee20'],
        ...overrides(),
      };
    }
  );
