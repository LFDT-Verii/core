import { afterEach, describe, it, mock } from 'node:test';
import { expect } from 'expect';
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import PropTypes from 'prop-types';
import useSignupRedirect from '../useSignupRedirect.js';

const authDomain = 'auth.example';
const signupPath =
  '/invitations/abc?signup_url=https%3A%2F%2Fauth.example%2Flo%2Freset%3Fticket%3Dt';

// Builds the invitation path the way the registrar API does, which double-encodes signup_url.
const buildSignupPath = (signupUrl) => {
  const params = new URLSearchParams();
  params.append('signup_url', encodeURI(signupUrl));
  return `/invitations/abc?${params}`;
};

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

const TestComponent = ({ auth, domain }) => {
  const { isSignupProcess } = useSignupRedirect({ auth, authDomain: domain });
  return <div data-testid="signup-process">{String(isSignupProcess)}</div>;
};

TestComponent.propTypes = {
  auth: PropTypes.shape({
    isAuthenticated: PropTypes.bool.isRequired,
    isLoading: PropTypes.bool.isRequired,
    logout: PropTypes.func.isRequired,
  }).isRequired,
  domain: PropTypes.string,
};

const renderAt = (path, auth, domain = authDomain) => {
  const result = render(
    <MemoryRouter initialEntries={[path]}>
      <TestComponent auth={auth} domain={domain} />
    </MemoryRouter>,
  );
  return {
    ...result,
    rerenderWith: (nextAuth) =>
      result.rerender(
        <MemoryRouter initialEntries={[path]}>
          <TestComponent auth={nextAuth} domain={domain} />
        </MemoryRouter>,
      ),
  };
};

const expectIgnored = async (auth) => {
  await settle();
  expect(screen.getByTestId('signup-process').textContent).toEqual('false');
  expect(auth.logout.mock.calls.length).toEqual(0);
  expect(localStorage.getItem('afterSignupRedirectUrl')).toEqual(null);
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

    await expectIgnored(auth);
  });

  [
    // eslint-disable-next-line no-script-url -- the hook must ignore this value
    ['a javascript: URL', 'javascript:void 0'],
    ['a link on another origin', 'https://elsewhere.example/lo/reset?ticket=t'],
    ['a plain http link on the Auth0 domain', 'http://auth.example/lo/reset?ticket=t'],
    ['a relative path', '/lo/reset?ticket=t'],
  ].forEach(([name, signupUrl]) => {
    it(`ignores ${name}`, async () => {
      const auth = buildAuth();

      renderAt(buildSignupPath(signupUrl), auth);

      await expectIgnored(auth);
    });
  });

  it('ignores a signup URL that cannot be decoded', async () => {
    const auth = buildAuth();

    renderAt('/invitations/abc?signup_url=https%3A%2F%2Fauth.example%2F%25E0%25A4%25A', auth);

    await expectIgnored(auth);
  });

  it('ignores every signup URL when no Auth0 domain is configured', async () => {
    const auth = buildAuth();

    renderAt(signupPath, auth, null);

    await expectIgnored(auth);
  });
});
