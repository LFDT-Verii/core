const { warn } = require('console');
const { filter, flow, groupBy } = require('lodash/fp');

const initFetchers = (options) => {
  const initFetch = (pathname, httpVerb = 'GET', body) => {
    return async () => {
      const urlObj = new URL(options.endpoint);
      urlObj.pathname = pathname;
      const fetchOptions = {
        headers: {
          Authorization: `Bearer ${options.authToken}`,
          'Content-Type': 'application/json',
        },
        method: httpVerb,
      };
      if (httpVerb === 'POST' && body != null) {
        fetchOptions.body = JSON.stringify(body);
      }
      const response = await fetch(urlObj.href, fetchOptions);
      const json = await response.json();
      if (!response.ok) {
        warn(json);
        throw new Error(`Response status: ${response.status}`, json);
      }
      return json;
    };
  };
  return {
    refreshTenants: initFetch('operator-api/v0.8/tenants/refresh', 'POST', {
      all: options.all,
      did: options.did,
    }),
    getTenants: initFetch('operator-api/v0.8/tenants'),
  };
};
const migrateTenantDid = async ({ options }) => {
  validateOptions(options);
  const context = { fetchers: initFetchers(options), options, log: console };
  const preTenants = await context.fetchers.getTenants();
  await context.fetchers.refreshTenants();
  const postTenants = await context.fetchers.getTenants();
  summarize(preTenants, postTenants, context);
};

const validateOptions = (options) => {
  if (options.did != null && options.all != null) {
    throw new Error('--did and --all flags may not both be specified.');
  }
  if (options.did == null && options.all == null) {
    throw new Error('either --did or --all flag must be specified.');
  }
};

const summarize = (preTenants, postTenants, context) => {
  const toOperatorUrl = initToOperatorApiUrl(context);
  const refreshedTenants = flow(
    groupBy('id'),
    filter((group) => group[0].did !== group[1].did)
  )([...preTenants, ...postTenants]);
  context.log.info(
    `Refreshed ${refreshedTenants.length} out of ${preTenants.length} tenants\n`
  );
  for (const refreshedTenant of refreshedTenants) {
    const [preTenant, postTenant] = refreshedTenant;
    context.log.info(
      {
        oldDid: preTenant.did,
        newUrlParam: preTenant.id,
        oldUrlPattern: toOperatorUrl(':did'),
        newUrlPattern: toOperatorUrl(':id'),
        oldUrl: toOperatorUrl(preTenant.did),
        newUrl: toOperatorUrl(postTenant.id),
      },
      '\n'
    );
  }
};

const initToOperatorApiUrl = (context) => (path) => {
  const url = new URL(context.options.endpoint);
  url.pathname = `operator-api/v0.8/tenants/${path}`;
  return url.href;
};

module.exports = { migrateTenantDid };
