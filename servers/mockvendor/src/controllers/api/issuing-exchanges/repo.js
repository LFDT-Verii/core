const {
  autoboxIdsExtension,
  repoFactory,
} = require('@spencejs/spence-mongo-repos');

const repo = (app, opts, next = () => {}) => {
  next();
  return repoFactory(
    {
      name: 'issuingExchanges',
      entityName: 'issuingExchange',
      defaultProjection: {
        _id: 1,
        type: 1,
        issuer: 1,
        exchangeId: 1,
        vendorUserId: 1,
        createdAt: 1,
        updatedAt: 1,
      },
      extensions: [autoboxIdsExtension],
    },
    app
  );
};

module.exports = repo;
