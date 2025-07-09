const createSection = async (
  { orgName, statusPageId },
  { betterUptimeFetch }
) => {
  const payload = {
    name: orgName,
    position: 0,
  };
  return betterUptimeFetch
    .post(`status-pages/${statusPageId}/sections`, { json: payload })
    .json();
};

module.exports = {
  createSection,
};
