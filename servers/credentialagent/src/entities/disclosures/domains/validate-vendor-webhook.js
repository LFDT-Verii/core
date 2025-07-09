const { isEmpty } = require('lodash');
const newError = require('http-errors');

const validateVendorWebhook = (tenant, context) => {
  const {
    config: { vendorUrl },
  } = context;

  if (isEmpty(vendorUrl) && isEmpty(tenant?.webhookUrl)) {
    throw newError(400, 'Vendor URL is required', {
      errorCode: 'vendor_url_required',
    });
  }
};

module.exports = {
  validateVendorWebhook,
};
