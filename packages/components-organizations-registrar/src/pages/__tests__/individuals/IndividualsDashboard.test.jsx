import { describe, it } from 'node:test';
import { render } from '@testing-library/react';
import { AdminContext } from 'react-admin';
import { testDataProvider } from 'ra-core';
import IndividualsDashboard from '../../individuals/IndividualsDashboard.jsx';

describe('IndividualsDashboard', () => {
  it('renders the component without errors', () => {
    render(
      <AdminContext
        dataProvider={testDataProvider({
          getList: () =>
            Promise.resolve({
              data: [
                {
                  profile: {
                    adminGivenName: 'John',
                    adminFamilyName: 'Smith',
                    adminEmail: 'johnsmith@example.com',
                    adminTitle: 'CEO',
                  },
                },
              ],
            }),
        })}
      >
        <IndividualsDashboard />
      </AdminContext>,
    );
  });
});
