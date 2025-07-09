const getAllSections = async (statusPageId, { betterUptimeFetch }) =>
  betterUptimeFetch.get(`status-pages/${statusPageId}/sections`).json();

module.exports = {
  getAllSections,
};
