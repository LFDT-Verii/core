const getAllSections = async (statusPageId, { betterUptimeFetch }) => {
  const response = await betterUptimeFetch.get(
    `status-pages/${statusPageId}/sections`,
  );

  return response.json();
};

module.exports = {
  getAllSections,
};
