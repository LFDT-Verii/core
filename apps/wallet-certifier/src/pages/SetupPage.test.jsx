import { test } from 'node:test';
import { expect } from 'expect';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import SetupPage from './SetupPage.jsx';

const wallets = [
  {
    id: 'did:web:vn.example#wallet',
    name: 'Velocity Wallet',
    organizationName: 'Velocity Wallet Co',
    protocols: ['VN_API'],
    eligible: true,
  },
  {
    id: 'did:web:dual.example#wallet',
    name: 'Dual Wallet',
    organizationName: 'Dual Wallet Co',
    protocols: ['VN_API', 'OPENID4VC'],
    eligible: true,
  },
  {
    id: 'did:web:openid.example#wallet',
    name: 'OpenID Wallet',
    organizationName: 'OpenID Wallet Co',
    protocols: ['OPENID4VC'],
    eligible: false,
    disabledReason: 'Phase one requires Velocity Network support.',
  },
];

const renderPage = (overrides = {}) => {
  const calls = [];
  const api = {
    searchWallets: async () => wallets,
    createRun: async (payload) => {
      calls.push(payload);
      return {
        runId: 'run-1',
        interactionToken: 'interaction-token',
      };
    },
    startRun: async () => ({
      redirectUrl: 'https://hub.example.test/app-redirect',
      qrValue: 'velocity-network://issue/1',
      state: 'ISSUING',
      actionDeadline: '2026-07-21T01:10:00.000Z',
      absoluteDeadline: '2026-07-21T01:15:00.000Z',
    }),
    ...overrides.api,
  };
  const onStarted = overrides.onStarted ?? (() => {});
  render(
    <SetupPage
      api={api}
      config={{
        brandName: 'Velocity Network Foundation',
        environmentName: 'devnet',
        registrationUrl: 'https://example.test/register',
      }}
      onStarted={onStarted}
    />,
  );
  return { calls };
};

test('searches registered wallets and explains phase-one eligibility', async () => {
  const user = userEvent.setup();
  renderPage();

  await user.type(screen.getByLabelText('Find your wallet'), 'wallet');
  await user.click(screen.getByRole('button', { name: 'Search registry' }));

  expect(await screen.findByText('Velocity Wallet')).toBeTruthy();
  expect(screen.getByText('Dual Wallet')).toBeTruthy();
  expect(screen.getByText('OpenID Wallet')).toBeTruthy();
  expect(
    screen.getByRole('button', { name: /select openid wallet/i }).disabled,
  ).toEqual(true);
  expect(
    screen.getByText('Phase one requires Velocity Network support.'),
  ).toBeTruthy();
  expect(
    screen
      .getByRole('link', { name: /register your wallet/i })
      .getAttribute('href'),
  ).toEqual('https://example.test/register');
});

test('validates identity and capability before beginning', async () => {
  const user = userEvent.setup();
  renderPage();

  await user.click(screen.getByRole('button', { name: 'Begin certification' }));

  expect(await screen.findByText('Select a registered wallet.')).toBeTruthy();
  expect(screen.getByText('Enter your name.')).toBeTruthy();
  expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
});

test('opens the wallet tab synchronously and starts an issuing run', async () => {
  const user = userEvent.setup();
  const openedTab = { location: { href: '' }, close: () => {} };
  const originalOpen = window.open;
  let opened = false;
  window.open = () => {
    opened = true;
    return openedTab;
  };
  const started = [];
  const { calls } = renderPage({
    onStarted: (value) => started.push(value),
    api: {
      createRun: async (payload) => {
        expect(opened).toEqual(true);
        calls.push(payload);
        return { runId: 'run-1', interactionToken: 'interaction-token' };
      },
    },
  });

  await user.type(screen.getByLabelText('Find your wallet'), 'velocity');
  await user.click(screen.getByRole('button', { name: 'Search registry' }));
  await user.click(
    await screen.findByRole('button', { name: /select velocity wallet/i }),
  );
  await user.type(screen.getByLabelText('Your name'), 'Alex Example');
  await user.type(screen.getByLabelText('Work email'), 'alex@example.com');
  await user.click(screen.getByLabelText(/^Certify issuing/));
  await user.click(screen.getByRole('button', { name: 'Begin certification' }));

  expect(calls).toEqual([
    {
      walletId: 'did:web:vn.example#wallet',
      applicantName: 'Alex Example',
      applicantEmail: 'alex@example.com',
      capability: 'ISSUING',
    },
  ]);
  expect(openedTab.location.href).toEqual(
    'https://hub.example.test/app-redirect',
  );
  expect(started).toHaveLength(1);
  window.open = originalOpen;
});
