const {
  autoboxIdsExtension,
  repoFactory,
} = require('@spencejs/spence-mongo-repos');

module.exports = (app, opts, next = () => {}) => {
  next();
  return repoFactory(
    {
      name: 'messages',
      entityName: 'message',
      defaultProjection: {
        _id: 1,
        messageType: 1,
        messageId: 1,
        payload: 1,
        createdAt: 1,
        updatedAt: 1,
      },
      extensions: [autoboxIdsExtension],
    },
    app
  );
};
