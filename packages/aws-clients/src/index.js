module.exports = {
  ...require('./document-storage'),
  ...require('./email-notifications'),
  ...require('./kms-client'),
  ...require('./s3-client'),
  ...require('./sms-notifications'),
  ...require('./send-email-plugin'),
  ...require('./send-sms-plugin'),
};
