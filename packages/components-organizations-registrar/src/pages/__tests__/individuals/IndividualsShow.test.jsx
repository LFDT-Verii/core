import { describe, it } from 'node:test';
import { BrowserRouter as Router } from 'react-router';
import { render } from '@testing-library/react';
import { TestAuthProvider } from '@/utils/auth/__tests__/TestAuthProvider.jsx';
import { AdminContext } from 'react-admin';
import { testDataProvider } from 'ra-core';
import IndividualsShow from '../../individuals/IndividualsShow.jsx';

// Todo: investigate how to cover with tests UI of react-admin
describe('IndividualsShow', () => {
  it('renders the component without errors', () => {
    render(
      <TestAuthProvider>
        <AdminContext
          dataProvider={testDataProvider({
            getOne: () =>
              Promise.resolve({
                data: {
                  profile: {
                    adminGivenName: 'John',
                    adminFamilyName: 'Smith',
                    adminEmail: 'johnsmith@example.com',
                    adminTitle: 'CEO',
                  },
                },
              }),
          })}
        >
          <Router>
            <IndividualsShow />
          </Router>
        </AdminContext>
      </TestAuthProvider>,
    );
  });
});
