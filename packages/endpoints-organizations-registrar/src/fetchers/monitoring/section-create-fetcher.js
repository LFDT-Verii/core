const createSection = async (
  { orgName, statusPageId },
  { betterUptimeFetch }
) => {
  const payload = {
    name: orgName,
    position: 0,
  };

  const response = await betterUptimeFetch.post(
    `status-pages/${statusPageId}/sections`,
    payload
  );

  return response.json();
};

module.exports = {
  createSection,
};
