import { test } from 'node:test';
import { expect } from 'expect';
import { api } from './api';

test('unwraps wallet search results from the API response', async (context) => {
  const wallets = [{ id: 'did:web:wallet.example#holder' }];
  context.mock.method(globalThis, 'fetch', async () =>
    Response.json({ wallets }),
  );

  await expect(api.searchWallets('velocity')).resolves.toEqual(wallets);
});

test('rejects an executable wallet interaction redirect', async (context) => {
  context.mock.method(globalThis, 'fetch', async () =>
    Response.json({
      state: 'ISSUING',
      // eslint-disable-next-line no-script-url
      redirectUrl: 'javascript:alert(document.domain)',
      qrValue: 'velocity-network://issue/request-1',
    }),
  );

  await expect(api.startRun('run-1', 'interaction-token')).rejects.toThrow(
    'The wallet interaction URL is invalid.',
  );
});

test('preserves API error status and code', async (context) => {
  context.mock.method(globalThis, 'fetch', async () =>
    Response.json(
      {
        error: 'run_not_found',
        message: 'Certification run not found.',
      },
      { status: 404 },
    ),
  );

  await expect(api.getRun('missing-run', 'interaction-token')).rejects.toEqual(
    expect.objectContaining({
      message: 'Certification run not found.',
      status: 404,
      code: 'run_not_found',
    }),
  );
});
