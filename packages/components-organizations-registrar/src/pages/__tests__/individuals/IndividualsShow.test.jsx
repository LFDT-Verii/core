// eslint-disable-next-line no-unused-vars,import/no-extraneous-dependencies
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// eslint-disable-next-line no-unused-vars
import { BrowserRouter as Router } from 'react-router';
import { render } from '@testing-library/react';
// eslint-disable-next-line no-unused-vars
import { TestAuthProvider } from '@/utils/auth/__tests__/TestAuthProvider.jsx';
import IndividualsShow from '../../individuals/IndividualsShow.jsx';
// eslint-disable-next-line no-unused-vars

const queryClient = new QueryClient();

// Todo: investigate how to cover with tests UI of react-admin
describe('IndividualsShow', () => {
  it('renders the component without errors', () => {
    render(
      <TestAuthProvider>
        <QueryClientProvider client={queryClient}>
          <Router>
            <IndividualsShow />
          </Router>
        </QueryClientProvider>
      </TestAuthProvider>,
    );
  });
});
