import { afterEach, describe, it, mock } from 'node:test';
import { expect } from 'expect';
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import PropTypes from 'prop-types';
import useSignupRedirect from '../useSignupRedirect.js';

const signupPath = '/invitations/abc?signup_url=https%3A%2F%2Fauth.example';

// Gives effects time to run when asserting that something did not happen.
const settle = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 50);
  });

const buildAuth = (overrides = {}) => ({
  isLoading: false,
  isAuthenticated: false,
  login: mock.fn(() => Promise.resolve()),
  logout: mock.fn(() => new Promise(() => {})),
  ...overrides,
});

const TestComponent = ({ auth }) => {
  const { isSignupProcess } = useSignupRedirect({ auth });
  return <div data-testid="signup-process">{String(isSignupProcess)}</div>;
};

TestComponent.propTypes = {
  auth: PropTypes.shape({
    isAuthenticated: PropTypes.bool.isRequired,
    isLoading: PropTypes.bool.isRequired,
    logout: PropTypes.func.isRequired,
  }).isRequired,
};

const renderAt = (path, auth) => {
  const result = render(
    <MemoryRouter initialEntries={[path]}>
      <TestComponent auth={auth} />
    </MemoryRouter>,
  );
  return {
    ...result,
    rerenderWith: (nextAuth) =>
      result.rerender(
        <MemoryRouter initialEntries={[path]}>
          <TestComponent auth={nextAuth} />
        </MemoryRouter>,
      ),
  };
};

describe('useSignupRedirect', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('logs out and keeps the return path when an invitation carries a signup URL', async () => {
    const auth = buildAuth();

    renderAt(signupPath, auth);

    await waitFor(() => expect(auth.logout.mock.calls.length).toEqual(1));
    expect(auth.logout.mock.calls[0].arguments).toEqual([{ source: 'signup-redirect' }]);
    expect(localStorage.getItem('afterSignupRedirectUrl')).toEqual('/invitations/abc');
    expect(screen.getByTestId('signup-process').textContent).toEqual('true');
    expect(auth.login.mock.calls.length).toEqual(0);
  });

  it('starts the redirect once when logging out changes the auth state', async () => {
    const auth = buildAuth();
    const { rerenderWith } = renderAt(signupPath, auth);
    await waitFor(() => expect(auth.logout.mock.calls.length).toEqual(1));

    const loggingOutAuth = buildAuth({ isLogoutInProgress: true });
    rerenderWith(loggingOutAuth);

    await settle();
    expect(auth.logout.mock.calls.length).toEqual(1);
    expect(loggingOutAuth.logout.mock.calls.length).toEqual(0);
  });

  it('does nothing without a signup URL', async () => {
    const auth = buildAuth();

    renderAt('/invitations/abc', auth);

    await settle();
    expect(screen.getByTestId('signup-process').textContent).toEqual('false');
    expect(auth.logout.mock.calls.length).toEqual(0);
    expect(localStorage.getItem('afterSignupRedirectUrl')).toEqual(null);
  });
});
