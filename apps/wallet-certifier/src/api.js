const requestJson = async (path, options = {}) => {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message ?? 'The request could not be completed.');
  }
  if (response.status === 204) {
    return undefined;
  }
  return response.json();
};

export const api = {
  getConfig: () => requestJson('/api/config'),
  searchWallets: (query) =>
    requestJson(`/api/wallets?q=${encodeURIComponent(query)}`),
  createRun: (payload) =>
    requestJson('/api/runs', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  startRun: (runId, token) =>
    requestJson(`/api/runs/${encodeURIComponent(runId)}/start`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    }),
  getRun: (runId, token) =>
    requestJson(`/api/runs/${encodeURIComponent(runId)}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
  createResultSession: (runId, token) =>
    requestJson('/api/result-sessions', {
      method: 'POST',
      body: JSON.stringify({ runId, token }),
    }),
};
