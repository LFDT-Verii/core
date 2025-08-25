const fetchJson = async (link, context) => {
  const { fetch } = context;
  const response = await fetch(context).get(link, {});

  return response.json();
}

module.exports = {
  fetchJson,
};
