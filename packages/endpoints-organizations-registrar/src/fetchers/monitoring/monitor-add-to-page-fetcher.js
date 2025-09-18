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

  const response = await betterUptimeFetch.post(
    `status-pages/${statusPageId}/resources`,
    payload
  );

  return response.json();
};
module.exports = {
  addMonitorToStatusPage,
};
