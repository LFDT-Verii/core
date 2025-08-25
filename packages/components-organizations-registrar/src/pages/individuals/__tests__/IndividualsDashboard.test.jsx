/*
 * Copyright 2025 Velocity Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import { before, describe, it, mock } from 'node:test';
import { expect } from 'expect';
import * as matchers from '@testing-library/jest-dom/matchers';
import { render, waitFor } from '@testing-library/react';
import { AdminContext } from 'react-admin';

expect.extend(matchers);

mock.module('@/state/selectedOrganizationState.js', {
  defaultExport: () => ['org-1', () => {}],
});

const useGetListMock = mock.fn(() => ({
  data: [
    {
      profile: {
        adminGivenName: 'John',
        adminFamilyName: 'Smith',
        adminEmail: 'johnsmith@example.com',
        adminTitle: 'CEO',
        signatoryGivenName: 'John',
        signatoryFamilyName: 'Smith',
        signatoryEmail: 'johnsmith@example.com',
        signatoryTitle: 'CEO',
      },
    },
  ],
  isLoading: false,
  total: 1,
  error: null,
  refetch: mock.fn(),
}));
const redirectMock = mock.fn();
const useRedirectMock = mock.fn(() => redirectMock);

mock.module('react-admin', {
  namedExports: {
    useRedirect: useRedirectMock,
    useGetList: useGetListMock,
  },
});

describe('IndividualsDashboard', () => {
  let IndividualsDashboard;
  before(async () => {
    IndividualsDashboard = (await import('../IndividualsDashboard.jsx')).default;
  });
  it('renders the component without errors', async () => {
    render(
      <AdminContext>
        <IndividualsDashboard />
      </AdminContext>,
    );
    await waitFor(() => {
      expect(redirectMock.mock.calls.length).toBeGreaterThan(0);
    });
  });
});
