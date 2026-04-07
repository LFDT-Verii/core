const defaultRpcUrl = 'http://localhost:8545';

const rpcUrl =
  process.env.TEST_RPC_URL || process.env.BESU_RPC_URL || defaultRpcUrl;
const chainIdValue =
  process.env.TEST_CHAIN_ID || process.env.BESU_CHAIN_ID || '';
const chainId = chainIdValue ? Number(chainIdValue) : undefined;

const explicitBearerToken = process.env.TEST_RPC_BEARER_TOKEN || '';
const authUrl = process.env.TEST_AUTH_URL || process.env.BESU_AUTH_URL || '';
const authClientId =
  process.env.TEST_AUTH_CLIENT_ID || process.env.BESU_CLIENT_ID || '';
const authClientSecret =
  process.env.TEST_AUTH_CLIENT_SECRET || process.env.BESU_CLIENT_SECRET || '';
const authScope =
  process.env.TEST_AUTH_SCOPE || process.env.BESU_AUTH_SCOPE || '';
const authAudience =
  process.env.TEST_AUTH_AUDIENCE || process.env.BESU_AUTH_AUDIENCE || '';
const authUseBasic =
  (
    process.env.TEST_AUTH_USE_BASIC ||
    process.env.BESU_AUTH_USE_BASIC ||
    ''
  ).toLowerCase() === 'true';

const parseExpiresInSeconds = (expiresIn) => {
  const parsed = Number(expiresIn);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return 300;
  }
  return parsed;
};

const buildTokenRequestBody = () => {
  const params = new URLSearchParams();
  params.set('grant_type', 'client_credentials');

  if (!authUseBasic) {
    params.set('client_id', authClientId);
    params.set('client_secret', authClientSecret);
  }
  if (authScope) {
    params.set('scope', authScope);
  }
  if (authAudience) {
    params.set('audience', authAudience);
  }

  return params.toString();
};

const buildTokenRequestHeaders = () => {
  const headers = {
    'content-type': 'application/x-www-form-urlencoded',
  };

  if (authUseBasic) {
    const encoded = Buffer.from(`${authClientId}:${authClientSecret}`).toString(
      'base64',
    );
    headers.authorization = `Basic ${encoded}`;
  }

  return headers;
};

let cachedToken = explicitBearerToken;
let tokenExpiresAt = explicitBearerToken ? Number.MAX_SAFE_INTEGER : 0;

const assertAuthCredentials = () => {
  if (!authClientId || !authClientSecret) {
    throw new Error(
      'Missing auth credentials: set TEST_AUTH_CLIENT_ID and TEST_AUTH_CLIENT_SECRET',
    );
  }
};

const extractAccessToken = (payload) => {
  const token = payload.access_token || payload.token || '';
  if (!token) {
    throw new Error('Token response did not include access_token');
  }

  return token;
};

const fetchAccessToken = async () => {
  if (!authUrl) {
    return '';
  }

  assertAuthCredentials();

  const response = await fetch(authUrl, {
    method: 'POST',
    headers: buildTokenRequestHeaders(),
    body: buildTokenRequestBody(),
  });

  if (!response.ok) {
    throw new Error(
      `Token request failed with status ${response.status} ${response.statusText}`,
    );
  }

  const payload = await response.json();
  const token = extractAccessToken(payload);
  const expiresInSeconds = parseExpiresInSeconds(payload.expires_in);
  const refreshWindowSeconds = 30;
  const ttl = Math.max(expiresInSeconds - refreshWindowSeconds, 1);
  tokenExpiresAt = Math.floor(Date.now() / 1000) + ttl;
  cachedToken = token;

  return token;
};

const authenticate = async () => {
  if (cachedToken && Math.floor(Date.now() / 1000) < tokenExpiresAt) {
    return cachedToken;
  }

  if (explicitBearerToken) {
    return explicitBearerToken;
  }

  const token = await fetchAccessToken();
  if (token) {
    return token;
  }

  // Backward-compatible default for local nodes without auth.
  return 'TOKEN';
};

module.exports = {
  rpcUrl,
  chainId,
  authenticate,
};
