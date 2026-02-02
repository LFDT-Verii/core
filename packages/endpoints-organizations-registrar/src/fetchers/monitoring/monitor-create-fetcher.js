const createMonitor = async (
  { monitorType, url, pronounceableName, requiredKeyword },
  { betterUptimeFetch },
) => {
  const payload = {
    monitor_type: monitorType,
    url,
    pronounceable_name: pronounceableName,
    email: true,
    sms: true,
    call: false,
    check_frequency: 5,
  };
  if (requiredKeyword) {
    payload.required_keyword = requiredKeyword;
  }

  const response = await betterUptimeFetch.post('monitors', payload);

  return response.json();
};

module.exports = {
  createMonitor,
};
