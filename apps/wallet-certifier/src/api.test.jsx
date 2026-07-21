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
