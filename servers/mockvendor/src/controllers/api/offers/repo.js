const {
  autoboxIdsExtension,
  repoFactory,
} = require('@spencejs/spence-mongo-repos');

const repo = (app, opts, next = () => {}) => {
  next();
  return repoFactory(
    {
      name: 'offers',
      entityName: 'offer',
      defaultProjection: {
        _id: 1,
        '@context': 1,
        type: 1,
        issuer: 1,
        credentialSubject: 1,
        linkedCredentials: 1,
        offerId: 1,
        exchangeId: 1,
        replaces: 1,
        relatedResource: 1,
        label: 1,
        createdAt: 1,
        updatedAt: 1,
      },
      extensions: [autoboxIdsExtension],
    },
    app
  );
};

module.exports = repo;
