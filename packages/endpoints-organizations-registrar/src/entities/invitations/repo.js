const {
  repoFactory,
  autoboxIdsExtension,
} = require('@spencejs/spence-mongo-repos');
const { deletedExtension } = require('@verii/spencer-mongo-extensions');

module.exports = (app, options, next = () => {}) => {
  next();
  return repoFactory(
    {
      name: 'invitations',
      entityName: 'invitations',
      defaultProjection: {
        _id: 1,
        acceptedAt: 1,
        acceptedBy: 1,
        invitationUrl: 1,
        inviterDid: 1,
        inviteeEmail: 1,
        inviteeService: 1,
        inviteeProfile: 1,
        keyIndividuals: 1,
        inviteeDid: 1,
        code: 1,
        expiresAt: 1,
        createdAt: 1,
        createdBy: 1,
        updatedAt: 1,
        updatedBy: 1,
        deletedAt: 1,
        deletedBy: 1,
      },
      extensions: [autoboxIdsExtension, deletedExtension()],
    },
    app,
  );
};
