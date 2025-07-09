const { castArray, compact, map, mergeAll } = require('lodash/fp');

const loadJsonldContext = async (json, { fetch, log }) => {
  if (json['@context'] == null) {
    return {};
  }

  try {
    const expandedContexts = await Promise.all(
      map(async (uri) => {
        const response =
          fetch.responseType === 'promise'
            ? await fetch.get(uri)
            : fetch.get(uri);

        return response.json().catch((error) => {
          log.warn({ error });
          return {};
        });
      }, castArray(json['@context']))
    );

    return mergeAll(compact(expandedContexts));
  } catch (error) {
    log.error(error);
    return {};
  }
};

module.exports = { loadJsonldContext };
