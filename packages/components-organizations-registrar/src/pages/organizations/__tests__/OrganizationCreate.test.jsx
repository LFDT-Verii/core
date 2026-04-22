import { before, describe, it, mock } from 'node:test';
import { expect } from 'expect';
import * as matchers from '@testing-library/jest-dom/matchers';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import * as reactAdminActual from 'react-admin';
import * as reactRouterActual from 'react-router';

import { AuthContext } from '@/utils/auth/AuthContext.js';
import { ConfigContext } from '@/utils/ConfigContext.js';

expect.extend(matchers);

const theme = createTheme({
  customColors: {
    grey2: '#9aa4b2',
  },
});

const createDeferred = () => {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const buildToken = (payload) => {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode(payload)}.signature`;
};

const EXPECTED_KEYS_DIALOG_TITLE = 'Your organization is now registered on Velocity Network™.';

const navigateMock = mock.fn();
const redirectMock = mock.fn();
const notifyMock = mock.fn();
const refetchMock = mock.fn();

let createControllerOptions;

const getAccessTokenMock = mock.fn();
const getAccessTokenWithPopupMock = mock.fn();

mock.module('react-router', {
  namedExports: {
    ...reactRouterActual,
    useNavigate: () => navigateMock,
    useLocation: () => ({ pathname: '/organizations/create/service' }),
  },
});

mock.module('react-admin', {
  namedExports: {
    ...reactAdminActual,
    useCreateController: (options) => {
      createControllerOptions = options;
      return { save: mock.fn() };
    },
    useRedirect: () => redirectMock,
    useGetOne: () => ({
      data: { givenName: 'New', familyName: 'User' },
      isLoading: false,
    }),
    useNotify: () => notifyMock,
    useGetList: () => ({
      refetch: refetchMock,
    }),
  },
});

mock.module('@/utils/countryCodes.js', {
  defaultExport: () => ({
    data: [{ id: 'AU', name: 'Australia' }],
    isLoading: false,
  }),
});

const renderOrganizationCreate = (OrganizationCreate) => {
  return render(
    <AuthContext.Provider
      value={{
        isLoading: false,
        isAuthenticated: true,
        user: { sub: 'auth0|new-user' },
        login: mock.fn(),
        logout: mock.fn(),
        getAccessToken: getAccessTokenMock,
        getAccessTokenWithPopup: getAccessTokenWithPopupMock,
      }}
    >
      <ConfigContext.Provider value={{ chainName: 'Devnet' }}>
        <ThemeProvider theme={theme}>
          <reactAdminActual.AdminContext store={reactAdminActual.memoryStore()} theme={theme}>
            <reactAdminActual.ResourceContextProvider value="organizations">
              <OrganizationCreate CreateServiceComponent={() => <div>Service Modal</div>} />
            </reactAdminActual.ResourceContextProvider>
          </reactAdminActual.AdminContext>
        </ThemeProvider>
      </ConfigContext.Provider>
    </AuthContext.Provider>,
  );
};

describe('OrganizationCreate', () => {
  let OrganizationCreate;

  before(async () => {
    OrganizationCreate = (await import('../OrganizationCreate.jsx')).default;
  });

  it('waits for access token refresh before opening the keys flow after organization creation', async () => {
    createControllerOptions = undefined;
    navigateMock.mock.resetCalls();
    refetchMock.mock.resetCalls();
    getAccessTokenMock.mock.resetCalls();
    getAccessTokenWithPopupMock.mock.resetCalls();

    const refreshDeferred = createDeferred();
    let tokenCallCount = 0;
    getAccessTokenMock.mock.mockImplementation(() => {
      tokenCallCount += 1;
      if (tokenCallCount === 1) {
        return Promise.resolve(
          buildToken({
            scope: 'write:organizations',
          }),
        );
      }
      return refreshDeferred.promise;
    });

    renderOrganizationCreate(OrganizationCreate);

    await waitFor(() => expect(createControllerOptions).toBeDefined());
    await waitFor(() => expect(getAccessTokenMock.mock.calls.length).toEqual(1));

    let onSuccessSettled = false;
    const onSuccessPromise = createControllerOptions.mutationOptions.onSuccess({
      id: 'did:test:new-org',
      keys: [],
      authClients: [],
    });
    onSuccessPromise.then(() => {
      onSuccessSettled = true;
    });

    await Promise.resolve();

    expect(getAccessTokenMock.mock.calls.length).toEqual(2);
    expect(refetchMock.mock.calls).toEqual([]);
    expect(navigateMock.mock.calls).toEqual([]);
    expect(onSuccessSettled).toEqual(false);
    expect(screen.queryByText(EXPECTED_KEYS_DIALOG_TITLE)).toBeNull();

    refreshDeferred.resolve(
      buildToken({
        scope: 'write:organizations',
        'http://velocitynetwork.foundation/groupId': 'did:test:new-org',
      }),
    );
    await onSuccessPromise;

    expect(refetchMock.mock.calls.length).toEqual(1);
    expect(navigateMock.mock.calls).toEqual([]);
    await waitFor(() => expect(screen.getByText(EXPECTED_KEYS_DIALOG_TITLE)).toBeInTheDocument());
  });

  it('falls back to popup refresh and still waits before opening the keys flow when silent refresh errors', async () => {
    createControllerOptions = undefined;
    navigateMock.mock.resetCalls();
    refetchMock.mock.resetCalls();
    getAccessTokenMock.mock.resetCalls();
    getAccessTokenWithPopupMock.mock.resetCalls();

    const popupDeferred = createDeferred();
    let tokenCallCount = 0;
    getAccessTokenMock.mock.mockImplementation(() => {
      tokenCallCount += 1;
      if (tokenCallCount === 1) {
        return Promise.resolve(
          buildToken({
            scope: 'write:organizations',
          }),
        );
      }
      throw Object.assign(new Error('Consent required'), {
        error: 'consent_required',
      });
    });
    getAccessTokenWithPopupMock.mock.mockImplementation(() => popupDeferred.promise);

    renderOrganizationCreate(OrganizationCreate);

    await waitFor(() => expect(createControllerOptions).toBeDefined());
    await waitFor(() => expect(getAccessTokenMock.mock.calls.length).toEqual(1));

    const onSuccessPromise = createControllerOptions.mutationOptions.onSuccess({
      id: 'did:test:new-org',
      keys: [],
      authClients: [],
    });
    onSuccessPromise.catch(() => {});

    await Promise.resolve();

    expect(getAccessTokenMock.mock.calls.length).toEqual(2);
    expect(getAccessTokenWithPopupMock.mock.calls.length).toEqual(1);
    expect(navigateMock.mock.calls).toEqual([]);
    expect(screen.queryByText(EXPECTED_KEYS_DIALOG_TITLE)).toBeNull();

    popupDeferred.resolve(
      buildToken({
        scope: 'write:organizations',
        'http://velocitynetwork.foundation/groupId': 'did:test:new-org',
      }),
    );
    await onSuccessPromise;

    expect(refetchMock.mock.calls.length).toEqual(1);
    expect(navigateMock.mock.calls).toEqual([]);
    await waitFor(() => expect(screen.getByText(EXPECTED_KEYS_DIALOG_TITLE)).toBeInTheDocument());
  });

  it('opens the keys flow when refresh fails with a non-interaction error', async () => {
    createControllerOptions = undefined;
    navigateMock.mock.resetCalls();
    refetchMock.mock.resetCalls();
    getAccessTokenMock.mock.resetCalls();
    getAccessTokenWithPopupMock.mock.resetCalls();

    let tokenCallCount = 0;
    const refreshError = new Error('network timeout');
    getAccessTokenMock.mock.mockImplementation(() => {
      tokenCallCount += 1;
      if (tokenCallCount === 1) {
        return Promise.resolve(
          buildToken({
            scope: 'write:organizations',
          }),
        );
      }

      return Promise.reject(refreshError);
    });

    renderOrganizationCreate(OrganizationCreate);

    await waitFor(() => expect(createControllerOptions).toBeDefined());
    await waitFor(() => expect(getAccessTokenMock.mock.calls.length).toEqual(1));

    await expect(
      createControllerOptions.mutationOptions.onSuccess({
        id: 'did:test:new-org',
        keys: [],
        authClients: [],
      }),
    ).resolves.toBeUndefined();

    expect(getAccessTokenWithPopupMock.mock.calls.length).toEqual(0);
    expect(refetchMock.mock.calls.length).toEqual(1);
    expect(navigateMock.mock.calls).toEqual([]);
    await waitFor(() => expect(screen.getByText(EXPECTED_KEYS_DIALOG_TITLE)).toBeInTheDocument());
  });
});
