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

import { describe, it } from 'node:test';
import { BrowserRouter as Router, Routes, Route } from 'react-router';
import { render, screen, waitFor } from '@testing-library/react';
import { expect } from 'expect';
import * as matchers from '@testing-library/jest-dom/matchers';
import IndividualsEdit from '../IndividualsEdit.jsx';

expect.extend(matchers);

// Todo: investigate how to cover with tests UI of react-admin
describe('IndividualsEdit', () => {
  it.skip('renders the component without errors', async () => {
    render(
      <Router>
        <Routes>
          <Route path="/edit/:id" element={<IndividualsEdit />} />
        </Routes>
      </Router>,
    );
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('First name')).toBeInTheDocument();
    });
  });
});
