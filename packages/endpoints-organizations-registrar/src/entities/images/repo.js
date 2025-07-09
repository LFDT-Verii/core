const {
  repoFactory,
  autoboxIdsExtension,
} = require('@spencejs/spence-mongo-repos');
const {
  findByUrlExtension,
  activateExtension,
  deactivateExtension,
} = require('./extension');

module.exports = (app, options, next = () => {}) => {
  next();
  return repoFactory(
    {
      name: 'images',
      entityName: 'images',
      defaultProjection: {
        _id: 1,
        key: 1,
        url: 1,
        uploadUrl: 1,
        userId: 1,
        state: 1,
        uploadSucceeded: 1,
        activateAt: 1,
        createdAt: 1,
        updatedAt: 1,
        errorCode: 1,
      },
      timestampKeys: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
      },
      extensions: [
        autoboxIdsExtension,
        findByUrlExtension,
        activateExtension,
        deactivateExtension,
      ],
    },
    app
  );
};
