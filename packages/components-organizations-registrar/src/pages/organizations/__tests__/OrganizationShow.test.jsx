import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AdminContext } from 'react-admin';
import Router, { MemoryRouter } from 'react-router';
import { TestAuthProvider } from '@/utils/auth/__tests__/TestAuthProvider.jsx';
import * as utils from '@/utils/index.jsx';
import OrganizationShow from '../OrganizationShow.jsx';

jest.mock('react-router', () => ({
  // __esModule: true,
  ...jest.requireActual('react-router'),
  useParams: jest.fn(),
}));

jest.mock('../../../utils/index.jsx', () => {
  return {
    __esModule: true,
    ...jest.requireActual('../../../utils/index.jsx'),
  };
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

const basicLables = [
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

describe('OrganizationShow', () => {
  // eslint-disable-next-line react/prop-types
  const Wrapper = ({ children }) => <MemoryRouter>{children}</MemoryRouter>;

  beforeEach(() => {
    jest.spyOn(Router, 'useParams').mockReturnValue({ id: '1234' });
    jest.spyOn(utils, 'copyTextToClipboard').mockReturnValue({ id: '1234' });
  });
  test('dispay Loading while isLoading=true', async () => {
    await act(async () =>
      render(
        <TestAuthProvider>
          <AdminContext
            dataProvider={{
              getOne: () => new Promise(() => {}),
            }}
          >
            <OrganizationShow />
          </AdminContext>
        </TestAuthProvider>,
        { wrapper: Wrapper },
      ),
    );
    const title = screen.queryByText('Organization profile');
    expect(title).not.toBeInTheDocument();
    const loader = screen.queryByRole('progressbar');
    expect(loader).toBeInTheDocument();
  });
  test('dispay screen with title and action', async () => {
    await act(async () =>
      render(
        <TestAuthProvider>
          <AdminContext
            dataProvider={{
              getOne: () => Promise.resolve({ data: mockRecord, isLoading: false }),
            }}
          >
            <OrganizationShow />
          </AdminContext>
        </TestAuthProvider>,
        { wrapper: Wrapper },
      ),
    );
    const title = screen.getByText('Organization profile');
    const editButton = screen.getByRole('button', { name: 'Edit Profile' });
    expect(title).toBeInTheDocument();
    expect(editButton).toBeInTheDocument();
  });
  test('dispay correct list of basic labales', async () => {
    await act(async () =>
      render(
        <TestAuthProvider>
          <AdminContext
            dataProvider={{
              getOne: () => Promise.resolve({ data: mockRecord, isLoading: false }),
            }}
          >
            <OrganizationShow />
          </AdminContext>
        </TestAuthProvider>,
        { wrapper: Wrapper },
      ),
    );
    basicLables.forEach((item) => {
      const label = screen.getByText(item);
      expect(label).toBeInTheDocument();
    });
  });
  test('dispay correct list of hints', async () => {
    await act(async () =>
      render(
        <TestAuthProvider>
          <AdminContext
            dataProvider={{
              getOne: () => Promise.resolve({ data: mockRecord, isLoading: false }),
            }}
          >
            <OrganizationShow />
          </AdminContext>
        </TestAuthProvider>,
        { wrapper: Wrapper },
      ),
    );
    hints.forEach((item) => {
      const label = screen.getByLabelText(item);
      expect(label).toBeInTheDocument();
    });
  });

  test('not dispay commercial section when no commercial names provided', async () => {
    await act(async () =>
      render(
        <TestAuthProvider>
          <AdminContext
            dataProvider={{
              getOne: () => Promise.resolve({ data: mockRecord, isLoading: false }),
            }}
          >
            <OrganizationShow />
          </AdminContext>
        </TestAuthProvider>,
        { wrapper: Wrapper },
      ),
    );
    const label = screen.queryByText('COMMERCIAL NAMES');
    expect(label).not.toBeInTheDocument();
  });
  test('dispay commercial section when commercial names provided', async () => {
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
    await act(async () =>
      render(
        <TestAuthProvider>
          <AdminContext
            dataProvider={{
              getOne: () => Promise.resolve({ data: mockRecordWithCommercials, isLoading: false }),
            }}
          >
            <OrganizationShow />
          </AdminContext>
        </TestAuthProvider>,
        { wrapper: Wrapper },
      ),
    );
    const label = screen.queryByText('Commercial Names');
    await waitFor(() => expect(label).toBeInTheDocument());
  });
  test('title of Copy button changes to Copied on click', async () => {
    const writeText = jest.fn();

    // eslint-disable-next-line better-mutation/no-mutating-functions
    Object.assign(navigator, {
      clipboard: {
        writeText,
      },
    });
    // eslint-disable-next-line no-undef
    navigator.clipboard.writeText.mockResolvedValue('123');
    await act(async () =>
      render(
        <TestAuthProvider>
          <AdminContext
            dataProvider={{
              getOne: () => Promise.resolve({ data: mockRecord, isLoading: false }),
            }}
          >
            <OrganizationShow />
          </AdminContext>
        </TestAuthProvider>,
        { wrapper: Wrapper },
      ),
    );
    const copyButton = screen.getByRole('button', { name: 'COPY' });
    expect(copyButton).toBeInTheDocument();
    fireEvent.click(copyButton);
    screen.findByRole('button', { name: 'COPIED' });
    expect(screen.findByRole('button', { name: 'COPY' })).toMatchObject({});
  });
});
