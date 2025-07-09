const createMonitor = async (
  { monitorType, url, pronounceableName, requiredKeyword },
  { betterUptimeFetch }
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

  return betterUptimeFetch.post('monitors', { json: payload }).json();
};

module.exports = {
  createMonitor,
};
