const {
  autoboxIdsExtension,
  repoFactory,
} = require('@spencejs/spence-mongo-repos');

module.exports = (app, opts, next = () => {}) => {
  next();
  return repoFactory(
    {
      name: 'applicants',
      entityName: 'applicant',
      defaultProjection: {
        _id: 1,
        firstName: 1,
        lastName: 1,
        email: 1,
        phone: 1,
        location: 1,
        presentationId: 1,
        vendorOrganizationId: 1,
        vendorDisclosureId: 1,
        exchangeId: 1,
        createdAt: 1,
        updatedAt: 1,
      },
      extensions: [autoboxIdsExtension],
    },
    app
  );
};
