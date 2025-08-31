const serviceVersion = async (url, { serviceVersionFetch }) => {
  const response = await serviceVersionFetch.get(url);

  return response.json();
};

module.exports = {
  serviceVersion,
};
