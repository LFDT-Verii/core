import { describe, it, mock } from 'node:test';
import { expect } from 'expect';
import { refreshAccessToken } from '../refreshAccessTokens.js';

describe('refreshAccessToken', () => {
  it('returns a fresh token silently when possible', async () => {
    const getAccessToken = mock.fn(() => Promise.resolve('silent-token'));
    const getAccessTokenWithPopup = mock.fn();

    await expect(refreshAccessToken({ getAccessToken, getAccessTokenWithPopup })).resolves.toEqual(
      'silent-token',
    );

    expect(getAccessToken.mock.calls[0].arguments).toEqual([{ cacheMode: 'off' }]);
    expect(getAccessTokenWithPopup.mock.calls.length).toEqual(0);
  });

  it('falls back to popup when silent refresh requires user interaction', async () => {
    const getAccessToken = mock.fn(() =>
      Promise.reject(
        Object.assign(new Error('Consent required'), {
          error: 'consent_required',
        }),
      ),
    );
    const getAccessTokenWithPopup = mock.fn(() => Promise.resolve('popup-token'));

    await expect(refreshAccessToken({ getAccessToken, getAccessTokenWithPopup })).resolves.toEqual(
      'popup-token',
    );

    expect(getAccessToken.mock.calls[0].arguments).toEqual([{ cacheMode: 'off' }]);
    expect(getAccessTokenWithPopup.mock.calls[0].arguments).toEqual([{ cacheMode: 'off' }]);
  });

  it('rethrows silent refresh errors that are not interaction related', async () => {
    const error = new Error('network timeout');
    const getAccessToken = mock.fn(() => Promise.reject(error));
    const getAccessTokenWithPopup = mock.fn();

    await expect(refreshAccessToken({ getAccessToken, getAccessTokenWithPopup })).rejects.toThrow(
      error,
    );

    expect(getAccessToken.mock.calls[0].arguments).toEqual([{ cacheMode: 'off' }]);
    expect(getAccessTokenWithPopup.mock.calls.length).toEqual(0);
  });
});
