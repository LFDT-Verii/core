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
