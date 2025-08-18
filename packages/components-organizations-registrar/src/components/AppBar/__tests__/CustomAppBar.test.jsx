import { before, describe, it, mock } from 'node:test';
import { expect } from 'expect';
import * as matchers from '@testing-library/jest-dom/matchers';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AdminContext, memoryStore, useLogout } from 'react-admin';
import { Link } from 'react-router';

expect.extend(matchers);

const useGetListMock = mock.fn(() => ({
  data: [
    {
      id: 'org-1',
      profile: {
        name: 'Test Org',
        logo: 'logo.png',
        location: { countryCode: 'US' },
      },
    },
  ],
  isLoading: false,
  total: 1,
  error: null,
  refetch: mock.fn(),
}));

const useRedirectMock = mock.fn(() => mock.fn());
mock.module('react-admin', {
  namedExports: {
    useLogout,
    useGetList: useGetListMock,
    useRedirect: useRedirectMock,
  },
});

mock.module('react-router', {
  namedExports: {
    Link,
    useLocation: () => ({
      pathname: '/organizations/did%3Aweb%3Aa.com/show',
    }),
  },
});

mock.module('@/state/selectedOrganizationState.js', {
  defaultExport: () => ['org-1', () => {}],
});
mock.module('@/utils/countryCodes.js', {
  defaultExport: () => ({
    getCountryNameByCode: mock.fn((code) => (code === 'US' ? 'United States' : 'Unknown')),
  }),
});
const useCheckUserHasGroupMock = mock.fn();
mock.module('../hooks/useCheckUserHasGroup.js', {
  namedExports: { useCheckUserHasGroup: useCheckUserHasGroupMock },
});

describe('CustomAppBar', () => {
  let CustomAppBar;
  before(async () => {
    CustomAppBar = (await import('../CustomAppBar.jsx')).default;
  });
  it('renders AppBarOrganization when hasOrganisations is true', async () => {
    useCheckUserHasGroupMock.mock.mockImplementation(() => ({
      hasOrganisations: true,
      isLoading: false,
    }));

    render(
      <AdminContext store={memoryStore()}>
        <CustomAppBar />
      </AdminContext>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('app-bar-org')).toBeInTheDocument();
    });
  });

  it('does not render AppBarOrganization when hasOrganisations is false', async () => {
    useCheckUserHasGroupMock.mock.mockImplementation(() => ({
      hasOrganisations: false,
      isLoading: false,
    }));

    render(
      <AdminContext store={memoryStore()}>
        <CustomAppBar />
      </AdminContext>,
    );
    await waitFor(() => {
      expect(screen.queryByTestId('app-bar-org')).not.toBeInTheDocument();
    });
  });
});
