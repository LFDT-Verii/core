const { startNotificationWorker } = require('./start-notification-worker');

module.exports = {
  ...require('./start-app-server'),
  startNotificationWorker,
};
