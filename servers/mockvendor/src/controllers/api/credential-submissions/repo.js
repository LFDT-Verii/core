const {
  autoboxIdsExtension,
  repoFactory,
} = require('@spencejs/spence-mongo-repos');

module.exports = (app, opts, next = () => {}) => {
  next();
  return repoFactory(
    {
      name: 'credentialSubmissions',
      entityName: 'credentialSubmission',
      extensions: [autoboxIdsExtension],
    },
    app
  );
};
