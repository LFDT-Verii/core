const {
  repoFactory,
  autoboxIdsExtension,
} = require('@spencejs/spence-mongo-repos');
const {
  initObjectIdAutoboxExtension,
} = require('@verii/spencer-mongo-extensions');

module.exports = (app, options, next = () => {}) => {
  next();
  return repoFactory(
    {
      name: 'purchases',
      entityName: 'purchase',
      defaultProjection: {
        _id: 1,
        purchaseId: 1,
        userId: 1,
        purchaseEvents: 1,
        quoteMetadata: 1,
        couponBundle: 1,
        creditReceipt: 1,
        fiatReceipt: 1,
        clientId: 1,
        at: 1,
        updatedAt: 1,
        purchaseStatus: 1,
        purchaseType: 1,
        exchangeOrderId: 1,
      },
      timestampKeys: { createdAt: 'at', updatedAt: 'updatedAt' },
      extensions: [
        autoboxIdsExtension,
        initObjectIdAutoboxExtension('clientId'),
      ],
    },
    app
  );
};
