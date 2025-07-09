const {
  repoFactory,
  autoboxIdsExtension,
} = require('@spencejs/spence-mongo-repos');
const {
  registrarConsentRepoExtension,
} = require('./registrar-consent-repo-extension');

module.exports = (app, options, next = () => {}) => {
  next();
  return repoFactory(
    {
      name: 'registrarConsents',
      entityName: 'registrarConsents',
      defaultProjection: {
        _id: 1,
        consentId: 1,
        type: 1,
        version: 1,
        userId: 1,
        organizationId: 1,
        serviceId: 1,
        createdAt: 1,
      },
      timestampKeys: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
      mutable: false,
      extensions: [autoboxIdsExtension, registrarConsentRepoExtension],
    },
    app
  );
};
