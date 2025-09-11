const getAllMonitors = async ({ betterUptimeFetch }) => {
  const response = await betterUptimeFetch.get('monitors');

  return response.json();
};

module.exports = {
  getAllMonitors,
};
