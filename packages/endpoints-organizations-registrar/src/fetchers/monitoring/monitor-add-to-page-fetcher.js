const addMonitorToStatusPage = async (
  { resourceId, publicName, statusPageId, statusPageSectionId },
  { betterUptimeFetch }
) => {
  const payload = {
    resource_id: resourceId,
    resource_type: 'Monitor',
    public_name: publicName,
    explanation: 'Add Comment here',
    status_page_section_id: statusPageSectionId,
  };
  return betterUptimeFetch
    .post(`status-pages/${statusPageId}/resources`, { json: payload })
    .json();
};
module.exports = {
  addMonitorToStatusPage,
};
