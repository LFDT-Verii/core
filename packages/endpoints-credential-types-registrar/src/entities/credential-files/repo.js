const {
  repoFactory,
  autoboxIdsExtension,
} = require('@spencejs/spence-mongo-repos');

module.exports = (app, options, next = () => {}) => {
  next();
  return repoFactory(
    {
      name: 'credentialFiles',
      entityName: 'credentialFiles',
      defaultProjection: {
        _id: 1,
        s3Key: 1,
        url: 1,
        credentialFileType: 1,
        userId: 1,
        errorCode: 1,
        isValid: 1,
        validatedAt: 1,
        createdAt: 1,
      },
      timestampKeys: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
      },
      extensions: [autoboxIdsExtension],
    },
    app
  );
};
