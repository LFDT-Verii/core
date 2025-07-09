const deleteMonitor = async ({ monitorId }, { betterUptimeFetch }) =>
  betterUptimeFetch.delete(`monitors/${monitorId}`);

module.exports = {
  deleteMonitor,
};
