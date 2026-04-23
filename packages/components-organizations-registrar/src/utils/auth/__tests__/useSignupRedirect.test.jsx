import { afterEach, before, describe, it, mock } from 'node:test';
import { expect } from 'expect';
import React, { useState } from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import PropTypes from 'prop-types';

mock.module('react-admin', {
  namedExports: {
    useStore: (_key, initialValue) => useState(initialValue),
  },
});

describe('useSignupRedirect', () => {
  let useSignupRedirect;

  before(async () => {
    useSignupRedirect = (await import('../useSignupRedirect.js')).default;
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  const TestComponent = ({ auth }) => {
    useSignupRedirect({ auth });
    return null;
  };

  TestComponent.propTypes = {
    auth: PropTypes.shape({
      isAuthenticated: PropTypes.bool.isRequired,
      isLoading: PropTypes.bool.isRequired,
      login: PropTypes.func.isRequired,
      logout: PropTypes.func.isRequired,
    }).isRequired,
  };

  it('starts the normal login redirect after auth resolves logged out', async () => {
    const login = mock.fn(() => Promise.resolve());
    const auth = {
      isLoading: false,
      isAuthenticated: false,
      login,
      logout: mock.fn(() => Promise.resolve()),
    };

    render(
      <MemoryRouter initialEntries={['/organizations']}>
        <TestComponent auth={auth} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(login.mock.calls.length).toEqual(1));
    expect(login.mock.calls[0].arguments).toEqual([{ appState: { returnTo: '/organizations' } }]);
  });

  it('does not start normal login while an invitation signup URL is pending', async () => {
    const login = mock.fn(() => Promise.resolve());
    const logout = mock.fn(() => new Promise(() => {}));
    const auth = {
      isLoading: false,
      isAuthenticated: false,
      login,
      logout,
    };

    render(
      <MemoryRouter initialEntries={['/invitations/abc?signup_url=https%3A%2F%2Fauth.example']}>
        <TestComponent auth={auth} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(logout.mock.calls.length).toEqual(1));
    expect(login.mock.calls.length).toEqual(0);
  });
});
