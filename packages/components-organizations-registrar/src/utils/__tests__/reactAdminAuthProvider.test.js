import { describe, it, mock } from 'node:test';
import { expect } from 'expect';
// eslint-disable-next-line import/extensions
import initReactAdminAuthProvider from '../reactAdminAuthProvider.js';

describe('initReactAdminAuthProvider', () => {
  it('returns the Auth0 user identity', () => {
    const authProvider = initReactAdminAuthProvider({
      logout: mock.fn(),
      user: {
        sub: 'auth0|user-id',
        name: 'Auth User',
        picture: 'https://example.com/avatar.png',
      },
    });

    expect(authProvider.getIdentity()).toEqual({
      id: 'auth0|user-id',
      fullName: 'Auth User',
      avatar: 'https://example.com/avatar.png',
    });
  });

  it('does not throw when Auth0 clears the user during logout', () => {
    const authProvider = initReactAdminAuthProvider({
      logout: mock.fn(),
      user: undefined,
    });

    expect(authProvider.getIdentity()).toEqual({
      id: '',
      fullName: undefined,
      avatar: undefined,
    });
  });
});
