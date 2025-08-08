import { describe, it } from 'node:test';
import { BrowserRouter as Router, Routes, Route } from 'react-router';
import { render } from '@testing-library/react';
import IndividualsEdit from '../../individuals/IndividualsEdit.jsx';

// Todo: investigate how to cover with tests UI of react-admin
describe('IndividualsEdit', () => {
  it('renders the component without errors', () => {
    render(
      <Router>
        <Routes>
          <Route path="/edit/:id" element={<IndividualsEdit />} />
        </Routes>
      </Router>,
    );
  });
});
