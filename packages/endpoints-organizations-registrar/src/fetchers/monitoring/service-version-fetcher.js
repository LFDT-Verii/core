const serviceVersion = async (url, { serviceVersionFetch }) =>
  serviceVersionFetch.get(url);

module.exports = {
  serviceVersion,
};
