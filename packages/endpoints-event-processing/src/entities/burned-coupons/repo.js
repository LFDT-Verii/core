const {
  autoboxIdsExtension,
  repoFactory,
} = require('@spencejs/spence-mongo-repos');
const {
  initObjectIdAutoboxExtension,
} = require('@verii/spencer-mongo-extensions');

module.exports = (app, options, next = () => {}) => {
  next();
  return repoFactory(
    {
      name: 'burnedCoupons',
      entityName: 'burnedCoupons',
      defaultProjection: {
        _id: 1,
        purchaseId: 1,
        used: 1,
        at: 1,
        clientId: 1,
      },
      extensions: [
        autoboxIdsExtension,
        initObjectIdAutoboxExtension('clientId'),
      ],
    },
    app
  );
};
