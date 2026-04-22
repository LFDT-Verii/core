import { refreshAccessToken } from './refreshAccessTokens.js';

export const finalizePostOrganizationCreate = async ({
  getAccessToken,
  getAccessTokenWithPopup,
  refetchUserData,
  refreshPostCreateData = async () => undefined,
}) => {
  try {
    await refreshAccessToken({ getAccessToken, getAccessTokenWithPopup });
  } catch {
    // refreshAccessToken logs non-interaction failures internally; do not block exit.
  }

  await Promise.allSettled([
    Promise.resolve().then(refetchUserData),
    Promise.resolve().then(refreshPostCreateData),
  ]);
};
