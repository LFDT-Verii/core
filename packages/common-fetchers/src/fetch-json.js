const fetchJson = async (link, { fetch }) => {
  const response = await fetch.get(link, {});
  return response.json();
};

module.exports = {
  fetchJson,
};
