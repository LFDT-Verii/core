import { test } from 'node:test';
import { expect } from 'expect';
import { render, screen } from '@testing-library/react';
import React from 'react';
import ResultLinkPage from './ResultLinkPage.jsx';

test('exchanges and removes a fragment token before loading the result', async () => {
  window.history.replaceState(
    {},
    '',
    '/results/run-1#token=result-token-value',
  );
  const calls = [];
  render(
    <ResultLinkPage
      api={{
        createResultSession: async (runId, token) => {
          calls.push({ runId, token });
        },
        getRun: async () => ({
          runId: 'run-1',
          capability: 'ISSUING',
          state: 'PASSED',
          result: {
            passed: true,
            completedAt: '2026-07-21T01:05:00.000Z',
            credential: {
              issuedAt: '2026-07-21T01:04:30.000Z',
              json: { type: ['OpenBadgeCredential'] },
              jwt: 'issued.jwt',
            },
          },
        }),
      }}
      runId="run-1"
    />,
  );

  expect(await screen.findByText('Credential issued')).toBeTruthy();
  expect(calls).toEqual([{ runId: 'run-1', token: 'result-token-value' }]);
  expect(window.location.hash).toEqual('');
});

test('renders sanitized support diagnostics from a support result link', async () => {
  window.history.replaceState(
    {},
    '',
    '/support/runs/run-1#token=support-token-value',
  );
  render(
    <ResultLinkPage
      api={{
        createResultSession: async () => {},
        getRun: async () => ({
          audience: 'SUPPORT',
          runId: 'run-1',
          capability: 'VERIFICATION',
          state: 'PASSED',
          walletName: 'Velocity Test Wallet',
          walletOrganizationName: 'Example Wallet Company',
          completedAt: '2026-07-21T01:05:00.000Z',
          journal: [
            { state: 'DISCLOSING', at: '2026-07-21T01:04:00.000Z' },
            { state: 'PASSED', at: '2026-07-21T01:05:00.000Z' },
          ],
          notifications: [
            { role: 'APPLICANT', status: 'SENT', attemptCount: 1 },
            { role: 'SUPPORT', status: 'SENT', attemptCount: 1 },
          ],
        }),
      }}
      runId="run-1"
    />,
  );

  expect(await screen.findByText('Support diagnostics')).toBeTruthy();
  expect(screen.getByText('Velocity Test Wallet')).toBeTruthy();
  expect(screen.queryByText('private.jwt.value')).toBeNull();
});
