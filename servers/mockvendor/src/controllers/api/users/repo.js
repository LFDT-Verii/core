const {
  autoboxIdsExtension,
  repoFactory,
} = require('@spencejs/spence-mongo-repos');

module.exports = (app, opts, next = () => {}) => {
  next();
  return repoFactory(
    {
      name: 'users',
      entityName: 'user',
      defaultProjection: {
        _id: 1,
        firstName: 1,
        lastName: 1,
        emails: 1,
        phones: 1,
        address: 1,
        identityCredentials: 1,
        label: 1,
        token: 1,
        createdAt: 1,
        updatedAt: 1,
      },
      extensions: [autoboxIdsExtension],
    },
    app
  );
};
