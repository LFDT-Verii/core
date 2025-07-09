const { register } = require('@spencejs/spence-factories');
const initUsersRepo = require('../../src/controllers/api/users/repo');

module.exports = (app) =>
  register(
    'user',
    initUsersRepo(app)({ config: app.config }),
    async (overrides) => {
      return {
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
        label: 'test-label',
        ...overrides(),
      };
    }
  );
