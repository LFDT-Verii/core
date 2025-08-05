/* eslint-disable import/first */
import { describe, test, mock } from 'node:test';
import { expect } from 'expect';

mock.module('react-router', {
  namedExports: {
    useParams: mock.fn(() => ({ id: '1234' })),
  },
});

const mockRecord = {
  id: 1,
  profile: {
    name: 'Organization name',
    location: {
      countryCode: 'US',
    },
  },
};

mock.module('../../../utils/index.jsx', {
  namedExports: {
    copyTextToClipboard: mock.fn(() => ({ id: '1234' })),
  },
});

import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { AdminContext, testDataProvider, memoryStore } from 'react-admin';
import { MemoryRouter } from 'react-router';
import { TestAuthProvider } from '@/utils/auth/__tests__/TestAuthProvider.jsx';
import OrganizationShow from '../OrganizationShow.jsx';

const basicLabels = [
  'Legal Name',
  'Website',
  'Address',
  'Country',
  'LinkedIn Page',
  'LinkedIn Company Page ID',
  'Support Email',
  'Technical Contact Email',
  `D-U-N-S${String.fromCodePoint(174)} Number`,
  'LEI',
  'Local Country Registration ID',
  'Short Description',
  'DID',
  'Registrar Access Token',
];

const hints = [
  // eslint-disable-next-line max-len
  'To retrieve your LinkedIn Company ID, visit your company page on LinkedIn as an admin, and copy the number from the URL. For example, if your company page URL is https://www.linkedin.com/company/1234567/admin/, the ID is 1234567',
  // eslint-disable-next-line max-len
  'A decentralized identifiers (DID) is a type of identifier that enables verifiable, decentralized digital identity. A DID in The Velocity Network refers to an organization.',
];

describe.skip('OrganizationShow', () => {
  // eslint-disable-next-line react/prop-types
  const Wrapper = ({ children }) => (
    <TestAuthProvider>
      <MemoryRouter>{children}</MemoryRouter>
    </TestAuthProvider>
  );
  test('display Loading while isLoading=true', async () => {
    render(
      <AdminContext
        dataProvider={{
          getOne: () => new Promise(() => {}),
        }}
      >
        <OrganizationShow />
      </AdminContext>,
      // { wrapper: Wrapper },
    );
    const title = screen.queryByText('Organization profile');
    expect(title).toBeNull();
    const loader = screen.queryByRole('progressbar');
    expect(loader).toBeDefined();
  });
  test('display screen with title and action', async () => {
    render(
      <AdminContext
        dataProvider={testDataProvider({
          getOne: () => Promise.resolve({ data: mockRecord, isLoading: false }),
          getList: () => Promise.resolve({ data: undefined, isLoading: false }),
        })}
        store={memoryStore()}
      >
        <OrganizationShow />,
      </AdminContext>,
    );
    const title = screen.getByText('Organization profile');
    const editButton = screen.getByRole('button', { name: 'Edit Profile' });
    expect(title).toBeDefined();
    expect(editButton).toBeDefined();
  });
  test('display correct list of basic labels', async () => {
    render(
      <AdminContext
        dataProvider={{
          getOne: () => Promise.resolve({ data: mockRecord, isLoading: false }),
        }}
      >
        <OrganizationShow />
      </AdminContext>,
      { wrapper: Wrapper },
    );
    basicLabels.forEach((item) => {
      const label = screen.getByText(item);
      expect(label).toBeDefined();
    });
  });
  test('display correct list of hints', async () => {
    render(
      <AdminContext
        dataProvider={{
          getOne: () => Promise.resolve({ data: mockRecord, isLoading: false }),
        }}
      >
        <OrganizationShow />
      </AdminContext>,
      { wrapper: Wrapper },
    );
    hints.forEach((item) => {
      const label = screen.getByLabelText(item);
      expect(label).toBeDefined();
    });
  });

  test('not display commercial section when no commercial names provided', async () => {
    render(
      <AdminContext
        dataProvider={{
          getOne: () => Promise.resolve({ data: mockRecord, isLoading: false }),
        }}
      >
        <OrganizationShow />
      </AdminContext>,
      { wrapper: Wrapper },
    );
    const label = screen.queryByText('COMMERCIAL NAMES');
    expect(label).not.toBeDefined();
  });
  test('display commercial section when commercial names provided', async () => {
    const mockRecordWithCommercials = {
      id: 1,
      profile: {
        name: 'Organization name',
        location: {
          countryCode: 'US',
        },
        commercialEntities: [{ name: 'Commercial Name', logo: 'https://logo.com', type: 'Brand' }],
      },
    };
    render(
      <AdminContext
        dataProvider={{
          getOne: () => Promise.resolve({ data: mockRecordWithCommercials, isLoading: false }),
        }}
      >
        <OrganizationShow />
      </AdminContext>,
      { wrapper: Wrapper },
    );
    const label = screen.queryByText('Commercial Names');
    await waitFor(() => expect(label).toBeDefined());
  });
  test('title of Copy button changes to Copied on click', async (t) => {
    const writeText = t.mock.fn();

    // eslint-disable-next-line better-mutation/no-mutating-functions
    Object.assign(navigator, {
      clipboard: {
        writeText,
      },
    });
    // eslint-disable-next-line no-undef
    navigator.clipboard.writeText.mock.mockImplementation(() => Promise.resolve('123'));
    render(
      <AdminContext
        dataProvider={{
          getOne: () => Promise.resolve({ data: mockRecord, isLoading: false }),
        }}
      >
        <OrganizationShow />
      </AdminContext>,
      { wrapper: Wrapper },
    );
    const copyButton = screen.getByRole('button', { name: 'COPY' });
    expect(copyButton).toBeDefined();
    userEvent.click(copyButton);
    screen.findByRole('button', { name: 'COPIED' });
    expect(screen.findByRole('button', { name: 'COPY' })).toMatchObject({});
  });
});
