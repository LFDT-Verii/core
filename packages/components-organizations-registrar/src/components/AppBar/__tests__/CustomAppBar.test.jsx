import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AdminContext, memoryStore } from 'react-admin';
import * as selectedOrgState from '@/state/selectedOrganizationState';
import * as useCountryCodes from '@/utils/countryCodes';
import * as reactAdmin from 'react-admin';
import CustomAppBar from '../CustomAppBar.jsx';
import { useCheckUserHasGroup } from '../hooks/useCheckUserHasGroup.jsx';

jest.mock('react-admin', () => ({
  ...jest.requireActual('react-admin'),
  useGetList: jest.fn(),
  useRedirect: jest.fn(() => jest.fn()),
}));

jest.mock('react-router', () => ({
  ...jest.requireActual('react-router'),
  useLocation: () => ({
    pathname: '/organizations/did%3Aweb%3Aa.com/show',
  }),
}));

reactAdmin.useGetList.mockImplementation(() => ({
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
  refetch: jest.fn(),
}));

reactAdmin.useRedirect.mockImplementation(() => jest.fn());

jest.mock('@/state/selectedOrganizationState');
jest.mock('@/utils/countryCodes');
jest.mock('../hooks/useCheckUserHasGroup.jsx', () => ({
  useCheckUserHasGroup: jest.fn(),
}));

describe('CustomAppBar', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders AppBarOrganization when hasOrganisations is true', async () => {
    useCheckUserHasGroup.mockReturnValue({
      hasOrganisations: true,
      isLoading: false,
    });
    selectedOrgState.default.mockReturnValue(['org-1', jest.fn()]);
    useCountryCodes.default.mockReturnValue({
      getCountryNameByCode: jest.fn((code) => (code === 'US' ? 'United States' : 'Unknown')),
    });

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
    useCheckUserHasGroup.mockReturnValue({
      hasOrganisations: false,
      isLoading: false,
    });

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
