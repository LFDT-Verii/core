const { initSendEmailNotification } = require('@verii/aws-clients');

const createEmailSender = ({ awsRegion, awsEndpoint }) =>
  initSendEmailNotification({ awsRegion, awsEndpoint });

module.exports = { createEmailSender };
