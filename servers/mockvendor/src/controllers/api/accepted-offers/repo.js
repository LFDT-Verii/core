const {
  autoboxIdsExtension,
  repoFactory,
} = require('@spencejs/spence-mongo-repos');

const repo = (app, opts, next = () => {}) => {
  next();
  return repoFactory(
    {
      name: 'acceptedOffers',
      entityName: 'acceptedOffer',
      defaultProjection: {
        _id: 1,
        exchangeId: 1,
        offerIds: 1,
        createdAt: 1,
        updatedAt: 1,
      },
      extensions: [autoboxIdsExtension],
    },
    app
  );
};

module.exports = repo;
