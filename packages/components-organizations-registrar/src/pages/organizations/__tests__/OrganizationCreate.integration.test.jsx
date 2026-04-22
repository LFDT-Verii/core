import { before, describe, it, mock } from 'node:test';
import { expect } from 'expect';
import * as matchers from '@testing-library/jest-dom/matchers';
import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { QueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router';
import { CoreAdminContext, ResourceContextProvider, TestMemoryRouter } from 'ra-core';
import { memoryStore, testDataProvider } from 'react-admin';

import { AuthContext } from '@/utils/auth/AuthContext.js';
import { ConfigContext } from '@/utils/ConfigContext.js';

expect.extend(matchers);

const TEST_USER = {
  id: 'auth0|new-user',
  givenName: 'New',
  familyName: 'User',
  email: 'new.user@acme.example',
};
const TEST_ORGANIZATION_ID = 'did:test:new-org';
const EXPECTED_KEYS_DIALOG_TITLE = 'Your organization is now registered on Velocity Network™.';
const EXPECTED_KEYS_DIALOG_TEXT =
  'Please save your organization’s unique keys in a secure location, as they will not be available once you close this window.';
const EXPECTED_WARNING_TITLE = 'You must download a copy of your keys before exiting';
const EXPECTED_WARNING_TEXT =
  'Your organization’s unique keys are critical for managing your organization’s data ' +
  'on Velocity Network™. This information will not be available once you close this window.';
const ORGANIZATION_CREATE_RESPONSE = {
  data: {
    id: TEST_ORGANIZATION_ID,
    keys: [
      {
        didDocumentKey: {
          id: '#auth-key-1',
        },
        key: 'secret-key-value',
      },
    ],
    authClients: [],
  },
};

mock.module('@/utils/countryCodes.js', {
  defaultExport: () => ({
    data: [{ id: 'AU', name: 'Australia' }],
    isLoading: false,
  }),
});

const theme = createTheme({
  customColors: {
    grey2: '#9aa4b2',
  },
  components: {
    MuiBackdrop: {
      defaultProps: {
        transitionDuration: 0,
      },
    },
    MuiDialog: {
      defaultProps: {
        disableAutoFocus: true,
        disableEnforceFocus: true,
        disableRestoreFocus: true,
        disableScrollLock: true,
        transitionDuration: 0,
      },
    },
    MuiModal: {
      defaultProps: {
        disableAutoFocus: true,
        disableEnforceFocus: true,
        disablePortal: true,
        disableRestoreFocus: true,
        disableScrollLock: true,
      },
    },
  },
});

const buildToken = (payload) => {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode(payload)}.signature`;
};

const MockOrganizationButton = ({ setInitialRecord }) => (
  <button
    type="button"
    onClick={() =>
      setInitialRecord({
        profile: {
          name: 'Acme Org',
          website: 'https://acme.example',
          physicalAddress: {
            line1: '1 Harbour Street',
          },
          location: {
            countryCode: 'AU',
          },
          logo: 'https://cdn.example.com/logo.png',
          linkedInProfile: 'https://www.linkedin.com/company/acme-org',
          contactEmail: 'support@acme.example',
          technicalEmail: 'tech@acme.example',
          description: 'A registrar test organization',
          adminGivenName: 'Admin',
          adminFamilyName: 'User',
          signatoryGivenName: 'Sig',
          signatoryFamilyName: 'User',
          adminTitle: 'Administrator',
          signatoryTitle: 'Director',
          adminEmail: 'admin@acme.example',
          signatoryEmail: 'signatory@acme.example',
          registrationNumbers: [
            {
              authority: 'DunnAndBradstreet',
              number: '123456789',
            },
          ],
          commercialEntities: [],
        },
      })
    }
  >
    Fill Mock Organization
  </button>
);

const InterceptOnCreateMock = ({ isInterceptOnCreateOpen = false, onNext }) => {
  useEffect(() => {
    if (isInterceptOnCreateOpen) {
      onNext();
    }
  }, [isInterceptOnCreateOpen, onNext]);

  return null;
};

MockOrganizationButton.propTypes = {
  setInitialRecord: PropTypes.func.isRequired,
};

InterceptOnCreateMock.propTypes = {
  isInterceptOnCreateOpen: PropTypes.bool,
  onNext: PropTypes.func.isRequired,
};

const findDialogByText = async (text) => {
  const dialogText = await screen.findByText(text);
  const dialog = dialogText.closest('[role="dialog"]');

  expect(dialog).not.toBeNull();

  return dialog;
};

const wait = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const createGetAccessTokenMock = () => {
  let tokenCallCount = 0;

  return mock.fn(() => {
    tokenCallCount += 1;

    if (tokenCallCount === 1) {
      return Promise.resolve(
        buildToken({
          scope: 'write:organizations',
        }),
      );
    }

    return Promise.resolve(
      buildToken({
        scope: 'write:organizations',
        'http://velocitynetwork.foundation/groupId': TEST_ORGANIZATION_ID,
      }),
    );
  });
};

const createDataProvider = ({ assertCreate }) =>
  testDataProvider({
    getOne: (resource) => {
      if (resource === 'users') {
        return Promise.resolve({
          data: TEST_USER,
        });
      }

      throw new Error(`Unexpected getOne resource: ${resource}`);
    },
    getList: (resource) => {
      if (resource === 'organizations' || resource === 'search-profiles') {
        return Promise.resolve({ data: [], total: 0 });
      }

      throw new Error(`Unexpected getList resource: ${resource}`);
    },
    create: (resource, params) => {
      if (resource === 'organizations') {
        assertCreate(params);
        return Promise.resolve(ORGANIZATION_CREATE_RESPONSE);
      }

      throw new Error(`Unexpected create resource: ${resource}`);
    },
  });

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        gcTime: Infinity,
        retry: false,
      },
    },
  });

const ServicesListStub = () => <div>Services list</div>;

const OrganizationCreateRoute = ({ OrganizationCreateComponent }) => {
  return (
    <ResourceContextProvider value="organizations">
      <OrganizationCreateComponent
        MockOrganization={MockOrganizationButton}
        InterceptOnCreate={InterceptOnCreateMock}
      />
    </ResourceContextProvider>
  );
};

const RoutedOrganizationCreateApp = ({ OrganizationCreateComponent }) => {
  const { pathname } = useLocation();

  if (pathname === '/services') {
    return <ServicesListStub />;
  }

  if (pathname === '/organizations/create') {
    return <OrganizationCreateRoute OrganizationCreateComponent={OrganizationCreateComponent} />;
  }

  return null;
};

OrganizationCreateRoute.propTypes = {
  OrganizationCreateComponent: PropTypes.elementType.isRequired,
};

RoutedOrganizationCreateApp.propTypes = {
  OrganizationCreateComponent: PropTypes.elementType.isRequired,
};

const renderOrganizationCreateApp = ({ OrganizationCreateComponent, assertCreate }) => {
  let location;
  const getAccessTokenMock = createGetAccessTokenMock();
  const queryClient = createQueryClient();
  const renderResult = render(
    <TestMemoryRouter
      initialEntries={['/organizations/create']}
      locationCallback={(nextLocation) => {
        location = nextLocation;
      }}
    >
      <CoreAdminContext
        dataProvider={createDataProvider({ assertCreate })}
        queryClient={queryClient}
        store={memoryStore()}
      >
        <ConfigContext.Provider value={{ chainName: 'Devnet' }}>
          <AuthContext.Provider
            value={{
              isLoading: false,
              isAuthenticated: true,
              user: { sub: TEST_USER.id },
              login: mock.fn(),
              logout: mock.fn(),
              getAccessToken: getAccessTokenMock,
              getAccessTokenWithPopup: mock.fn(),
            }}
          >
            <ThemeProvider theme={theme}>
              <RoutedOrganizationCreateApp
                OrganizationCreateComponent={OrganizationCreateComponent}
              />
            </ThemeProvider>
          </AuthContext.Provider>
        </ConfigContext.Provider>
      </CoreAdminContext>
    </TestMemoryRouter>,
  );

  return {
    user: userEvent.setup(),
    getPathname: () => location?.pathname,
    cleanup: async () => {
      renderResult.unmount();
      queryClient.clear();
      cleanup();
      document.body.innerHTML = '';
      await wait(0);
    },
  };
};

const fillOrganizationDetails = async (user) => {
  await user.click(await screen.findByText('Fill Mock Organization'));
  await waitFor(() => {
    expect(screen.getByDisplayValue('Acme Org')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://acme.example')).toBeInTheDocument();
  });
};

const openAddServiceFlow = async (user) => {
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add Service' })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: 'Add Service' }));
  await screen.findByText('Step 1/2');
};

const closeKeysFlowAndAssertRedirect = async ({ user, getPathname }) => {
  const keysDialog = await findDialogByText(EXPECTED_KEYS_DIALOG_TITLE);
  expect(within(keysDialog).getByText(EXPECTED_KEYS_DIALOG_TEXT)).toBeInTheDocument();

  await wait(2000);
  const persistedKeysDialog = await findDialogByText(EXPECTED_KEYS_DIALOG_TITLE);
  expect(within(persistedKeysDialog).getByText(EXPECTED_KEYS_DIALOG_TEXT)).toBeInTheDocument();

  await user.click(within(persistedKeysDialog).getByLabelText('close'));

  const warningDialog = await findDialogByText(EXPECTED_WARNING_TITLE);
  expect(within(warningDialog).getByText(EXPECTED_WARNING_TEXT)).toBeInTheDocument();

  await user.click(within(warningDialog).getByLabelText('close'));

  await waitFor(() => {
    expect(getPathname()).toEqual('/services');
    expect(screen.getByText('Services list')).toBeInTheDocument();
  });
};

describe('OrganizationCreate integration', () => {
  let OrganizationCreate;

  before(async () => {
    OrganizationCreate = (await import('../OrganizationCreate.jsx')).default;
  });

  it('redirects to the services list after creating an organization with an initial service and completing the keys flow', async () => {
    const app = renderOrganizationCreateApp({
      OrganizationCreateComponent: OrganizationCreate,
      assertCreate: (params) => {
        expect(params.data.serviceEndpoints).toHaveLength(1);
        expect(params.data.serviceEndpoints[0].serviceEndpoint).toEqual('https://cao.example');
      },
    });

    try {
      await fillOrganizationDetails(app.user);
      await openAddServiceFlow(app.user);

      await app.user.click(screen.getByLabelText('Select type of service'));
      await app.user.click(
        screen.getByRole('option', { name: 'Credential Agent Operator', hidden: true }),
      );
      await app.user.click(screen.getByRole('button', { name: 'Next', hidden: true }));

      await screen.findByText('Step 2/2');
      expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
      await app.user.type(
        document.querySelector('[name="serviceEndpoint"]'),
        'https://cao.example',
      );
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Add', hidden: true })).toBeEnabled(),
      );
      await app.user.click(screen.getByRole('button', { name: 'Add', hidden: true }));

      await closeKeysFlowAndAssertRedirect(app);
    } finally {
      await app.cleanup();
    }
  });

  it('redirects to the services list after skipping the initial service and completing the keys flow', async () => {
    const app = renderOrganizationCreateApp({
      OrganizationCreateComponent: OrganizationCreate,
      assertCreate: (params) => {
        expect(params.data.serviceEndpoints).toEqual([]);
      },
    });

    try {
      await fillOrganizationDetails(app.user);
      await openAddServiceFlow(app.user);
      await app.user.click(screen.getByRole('button', { name: 'Do Later', hidden: true }));

      await closeKeysFlowAndAssertRedirect(app);
    } finally {
      await app.cleanup();
    }
  });
});
