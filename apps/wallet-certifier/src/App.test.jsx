import { test } from 'node:test';
import { expect } from 'expect';
import { render, screen } from '@testing-library/react';
import React from 'react';
import App from './App.jsx';

test('renders the wallet certifier heading', () => {
  window.history.replaceState({}, '', '/');
  render(<App />);
  expect(
    screen.getByRole('heading', { name: /wallet certifier/i }),
  ).toBeTruthy();
});

test('routes private support links to sanitized diagnostics', async () => {
  window.history.replaceState(
    {},
    '',
    '/support/runs/run-1#token=support-token-value',
  );
  render(
    <App
      api={{
        getConfig: async () => ({
          brandName: 'Velocity Network Foundation',
          environmentName: 'devnet',
          registrationUrl: 'https://example.test/register',
        }),
        searchWallets: async () => [],
        createRun: async () => ({}),
        startRun: async () => ({}),
        createResultSession: async () => {},
        getRun: async () => ({
          audience: 'SUPPORT',
          runId: 'run-1',
          capability: 'ISSUING',
          state: 'PASSED',
          walletName: 'Velocity Test Wallet',
          notifications: [],
          journal: [],
        }),
      }}
    />,
  );

  expect(await screen.findByText('Support diagnostics')).toBeTruthy();
});
