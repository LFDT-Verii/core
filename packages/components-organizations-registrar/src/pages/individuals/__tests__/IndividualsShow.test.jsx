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
import * as matchers from '@testing-library/jest-dom/matchers';
import { render, screen, waitFor } from '@testing-library/react';
import { TestAuthProvider } from '@/utils/auth/__tests__/TestAuthProvider.jsx';
import { AdminContext, useLogout, useRedirect, useStore } from 'react-admin';
import { expect } from 'expect';
import theme from '../../../theme/theme.js';

expect.extend(matchers);

const useGetOneMock = mock.fn(() => ({
  data: {
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
  isLoading: false,
}));

mock.module('react-admin', {
  namedExports: {
    useLogout,
    useStore,
    useRedirect,
    useGetOne: useGetOneMock,
  },
});

// Todo: investigate how to cover with tests UI of react-admin
describe('IndividualsShow', () => {
  let IndividualsShow;
  before(async () => {
    try {
      IndividualsShow = (await import('../IndividualsShow.jsx')).default;
    } catch (e) {
      console.error(e.message);
      throw e;
    }
  });
  it('renders the component without errors', async () => {
    render(
      <TestAuthProvider>
        <AdminContext theme={theme}>
          <IndividualsShow />
        </AdminContext>
      </TestAuthProvider>,
    );
    await waitFor(() => {
      expect(screen.queryByText('Key Individuals')).toBeInTheDocument();
    });
  });
});
