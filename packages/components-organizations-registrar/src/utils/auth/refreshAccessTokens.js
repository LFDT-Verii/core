const INTERACTION_REQUIRED_ERRORS = new Set([
  'consent_required',
  'interaction_required',
  'login_required',
]);

const isInteractionRequiredError = (error) => {
  return [error?.error, error?.errorCode, error?.code].some((code) =>
    INTERACTION_REQUIRED_ERRORS.has(code),
  );
};

const logNonInteractionRefreshError = (error) => {
  console.error('Non-interaction access token refresh failure', error);
};

export const refreshAccessToken = async ({
  getAccessToken,
  getAccessTokenWithPopup,
  options = { cacheMode: 'off' },
}) => {
  try {
    return await getAccessToken(options);
  } catch (error) {
    if (!isInteractionRequiredError(error)) {
      logNonInteractionRefreshError(error);
      throw error;
    }

    return getAccessTokenWithPopup(options);
  }
};
