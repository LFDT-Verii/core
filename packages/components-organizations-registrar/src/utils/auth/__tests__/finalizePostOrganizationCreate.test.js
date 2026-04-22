import { before, describe, it, mock } from 'node:test';
import { expect } from 'expect';

const refreshAccessTokenMock = mock.fn();

mock.module('../refreshAccessTokens.js', {
  namedExports: {
    refreshAccessToken: refreshAccessTokenMock,
  },
});

describe('finalizePostOrganizationCreate', () => {
  let finalizePostOrganizationCreate;

  before(async () => {
    ({ finalizePostOrganizationCreate } = await import('../finalizePostOrganizationCreate.js'));
  });

  it('refreshes auth, then user data, then post-create data', async () => {
    const getAccessToken = mock.fn();
    const getAccessTokenWithPopup = mock.fn();
    const refetchUserData = mock.fn(() => Promise.resolve());
    const refreshPostCreateData = mock.fn(() => Promise.resolve());

    refreshAccessTokenMock.mock.resetCalls();
    refreshAccessTokenMock.mock.mockImplementation(() => Promise.resolve('fresh-token'));

    await finalizePostOrganizationCreate({
      getAccessToken,
      getAccessTokenWithPopup,
      refetchUserData,
      refreshPostCreateData,
    });

    expect(refreshAccessTokenMock.mock.calls[0].arguments).toEqual([
      { getAccessToken, getAccessTokenWithPopup },
    ]);
    expect(refetchUserData.mock.calls.length).toEqual(1);
    expect(refreshPostCreateData.mock.calls.length).toEqual(1);
  });

  it('still refreshes user data and post-create data when token refresh fails', async () => {
    const refetchUserData = mock.fn(() => Promise.resolve());
    const refreshPostCreateData = mock.fn(() => Promise.resolve());

    refreshAccessTokenMock.mock.resetCalls();
    refreshAccessTokenMock.mock.mockImplementation(() =>
      Promise.reject(new Error('token refresh failed')),
    );

    await finalizePostOrganizationCreate({
      getAccessToken: mock.fn(),
      getAccessTokenWithPopup: mock.fn(),
      refetchUserData,
      refreshPostCreateData,
    });

    expect(refetchUserData.mock.calls.length).toEqual(1);
    expect(refreshPostCreateData.mock.calls.length).toEqual(1);
  });

  it('still resolves when user or post-create data refresh fails', async () => {
    refreshAccessTokenMock.mock.resetCalls();
    refreshAccessTokenMock.mock.mockImplementation(() => Promise.resolve('fresh-token'));

    await expect(
      finalizePostOrganizationCreate({
        getAccessToken: mock.fn(),
        getAccessTokenWithPopup: mock.fn(),
        refetchUserData: mock.fn(() => Promise.reject(new Error('user refetch failed'))),
        refreshPostCreateData: mock.fn(() =>
          Promise.reject(new Error('post-create refresh failed')),
        ),
      }),
    ).resolves.toBeUndefined();
  });
});
