const getAllMonitors = async ({ betterUptimeFetch }) =>
  betterUptimeFetch.get('monitors').json();

module.exports = {
  getAllMonitors,
};
