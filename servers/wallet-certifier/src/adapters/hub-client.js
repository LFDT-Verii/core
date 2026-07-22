class HubUnavailableError extends Error {
  constructor() {
    super('Credentialing Hub is temporarily unavailable.');
    this.code = 'HUB_UNAVAILABLE';
  }
}

const addQuery = (url, query = {}) => {
  for (const [name, value] of Object.entries(query)) {
    if (value != null) {
      url.searchParams.set(name, value);
    }
  }
};

const requestOptions = (method, body, operatorToken) => ({
  method,
  headers: {
    authorization: `Bearer ${operatorToken}`,
    ...(body ? { 'content-type': 'application/json' } : {}),
  },
  ...(body ? { body: JSON.stringify(body) } : {}),
  signal: AbortSignal.timeout(10000),
});

const fetchHubJson = async (fetchImpl, url, options) => {
  let response;
  try {
    response = await fetchImpl(url, options);
  } catch {
    throw new HubUnavailableError();
  }
  if (!response.ok) {
    throw new HubUnavailableError();
  }
  return response.json();
};

const validateHubResponse = (response, baseUrl) => {
  if (response?.redirectUrl == null) {
    return response;
  }
  try {
    const redirect = new URL(response.redirectUrl);
    if (redirect.origin !== new URL(baseUrl).origin) {
      throw new HubUnavailableError();
    }
  } catch {
    throw new HubUnavailableError();
  }
  return response;
};

const createHubClient = ({
  baseUrl,
  operatorToken,
  tenantId,
  fetchImpl = fetch,
}) => {
  const callJson = async (path, { method = 'GET', body, query } = {}) => {
    const url = new URL(path, baseUrl);
    addQuery(url, query);
    return validateHubResponse(
      await fetchHubJson(
        fetchImpl,
        url,
        requestOptions(method, body, operatorToken),
      ),
      baseUrl,
    );
  };

  return {
    createDepot: async ({ serviceId, userReference }) => {
      const response = await callJson('/operator/depots/create', {
        method: 'POST',
        body: {
          tenantId,
          serviceId,
          depot: { userReference },
        },
      });
      return response.depot;
    },
    createCredential: async ({ depotId, credentialReference, content }) => {
      const response = await callJson('/operator/credentials/create', {
        method: 'POST',
        body: {
          tenantId,
          depotId,
          credential: { credentialReference, content },
        },
      });
      return response.credential;
    },
    refreshIssueLink: (serviceId, depotId) =>
      callJson('/operator/issue-links/refresh', {
        method: 'POST',
        body: { tenantId, serviceId, depotId },
      }),
    getCredential: async (credentialId) => {
      const response = await callJson('/operator/credentials/get', {
        query: { tenantId, credentialId },
      });
      return response.credentials?.[0];
    },
    refreshPresentationLink: (serviceId, depotId) =>
      callJson('/operator/presentation-links/refresh', {
        method: 'POST',
        body: { tenantId, serviceId, depotId },
      }),
    getPresentations: async ({ depotId, exchangeId }) => {
      const response = await callJson('/operator/presentations/get', {
        query: { tenantId, depotId, exchangeId },
      });
      return response.presentations;
    },
    verifyPresentation: (presentationId) =>
      callJson('/operator/presentations/verify', {
        method: 'POST',
        body: { tenantId, presentationId },
      }),
    getExchange: async ({ exchangeId, depotId }) => {
      const response = await callJson('/operator/exchanges/get', {
        query: { tenantId, exchangeId, depotId },
      });
      return response.exchange;
    },
  };
};

module.exports = { HubUnavailableError, createHubClient };
