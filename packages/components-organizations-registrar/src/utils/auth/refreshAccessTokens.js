export const refreshAccessToken = async ({
  getAccessToken,
  getAccessTokenWithPopup,
  options = { cacheMode: 'off' },
}) => {
  try {
    return await getAccessToken(options);
  } catch {
    return getAccessTokenWithPopup(options);
  }
};
