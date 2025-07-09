const {
  repoFactory,
  autoboxIdsExtension,
} = require('@spencejs/spence-mongo-repos');
const {
  signatoryStatusStateRepoExtension,
} = require('./signatory-status-state-repo-extension');

module.exports = (app, options, next = () => {}) => {
  next();
  return repoFactory(
    {
      name: 'signatoryStatus',
      entityName: 'signatoryStatus',
      defaultProjection: {
        _id: 1,
        organizationDid: 1,
        organizationId: 1,
        approvedAt: 1,
        rejectedAt: 1,
        events: 1,
        authCodes: 1,
        error: 1,
        createdAt: 1,
        updatedAt: 1,
      },
      timestampKeys: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
      },
      extensions: [autoboxIdsExtension, signatoryStatusStateRepoExtension],
    },
    app
  );
};
