module.exports = {
  ...require('./handle-credential-issued-rewards-event'),
  ...require('./handle-coupons-burned-verification-event'),
  ...require('./handle-coupons-minted-logging-event'),
  ...require('./handle-coupons-burned-logging-event'),
  ...require('./handle-credential-issued-logging-event'),
};
