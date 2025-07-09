// eslint-disable-next-line import/no-extraneous-dependencies
import {
  QueryClient,
  // eslint-disable-next-line no-unused-vars
  QueryClientProvider,
} from '@tanstack/react-query';
// eslint-disable-next-line no-unused-vars
import { BrowserRouter as Router } from 'react-router';
import { render } from '@testing-library/react';
// eslint-disable-next-line no-unused-vars
import IndividualsDashboard from '../../individuals/IndividualsDashboard.jsx';

const queryClient = new QueryClient();

// Todo: investigate how to cover with tests UI of react-admin
describe('IndividualsDashboard', () => {
  it('renders the component without errors', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <Router>
          <IndividualsDashboard />
        </Router>
      </QueryClientProvider>,
    );
  });
});
