const {
  autoboxIdsExtension,
  repoFactory,
} = require('@spencejs/spence-mongo-repos');

module.exports = (app, opts, next = () => {}) => {
  next();
  return repoFactory(
    {
      name: 'identifications',
      entityName: 'identification',
      extensions: [autoboxIdsExtension],
      mutable: false,
      defaultProjection: {
        _id: 1,
        identification: 1,
        createdAt: 1,
      },
    },
    app
  );
};
