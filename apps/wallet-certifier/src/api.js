export class ApiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const requestJson = async (path, options = {}) => {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new ApiError(
      errorBody.message ?? 'The request could not be completed.',
      { status: response.status, code: errorBody.error },
    );
  }
  if (response.status === 204) {
    return undefined;
  }
  return response.json();
};

const normalizeInteraction = (interaction) => {
  let redirect;
  try {
    redirect = new URL(interaction.redirectUrl);
  } catch {
    throw new ApiError('The wallet interaction URL is invalid.');
  }
  const isLoopbackHttp =
    redirect.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(redirect.hostname);
  if (redirect.protocol !== 'https:' && !isLoopbackHttp) {
    throw new ApiError('The wallet interaction URL is invalid.');
  }
  return { ...interaction, redirectUrl: redirect.toString() };
};

export const api = {
  getConfig: () => requestJson('/api/config'),
  searchWallets: async (query) => {
    const { wallets } = await requestJson(
      `/api/wallets?q=${encodeURIComponent(query)}`,
    );
    return wallets;
  },
  createRun: (payload) =>
    requestJson('/api/runs', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  startRun: async (runId, token) =>
    normalizeInteraction(
      await requestJson(`/api/runs/${encodeURIComponent(runId)}/start`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      }),
    ),
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
