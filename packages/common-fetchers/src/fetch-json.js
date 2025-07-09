const fetchJson = async (link, { fetch }) => fetch.get(link, {}).json();

module.exports = {
  fetchJson,
};
