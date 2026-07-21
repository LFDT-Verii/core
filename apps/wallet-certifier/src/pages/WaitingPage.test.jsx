import { test } from 'node:test';
import { expect } from 'expect';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import WaitingPage from './WaitingPage.jsx';

const interaction = {
  state: 'ISSUING',
  redirectUrl: 'https://hub.example.test/app-redirect',
  qrValue: 'velocity-network://issue/request-1',
  actionDeadline: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  absoluteDeadline: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
};

test('shows waiting guidance, progress, countdown, and QR fallback', async () => {
  render(
    <WaitingPage
      api={{
        getRun: async () => ({
          runId: 'run-1',
          capability: 'ISSUING',
          state: 'ISSUING',
          actionDeadline: interaction.actionDeadline,
          absoluteDeadline: interaction.absoluteDeadline,
        }),
        startRun: async () => interaction,
      }}
      runId="run-1"
      initialRun={{
        interactionToken: 'interaction-token',
        capability: 'ISSUING',
        interaction,
      }}
    />,
  );

  expect(
    screen.getByRole('heading', { name: /issue the setup badge/i }),
  ).toBeTruthy();
  expect(screen.getByText(/do not close this page/i)).toBeTruthy();
  expect(screen.getByText(/time remaining/i)).toBeTruthy();
  expect(screen.getByRole('img', { name: /wallet qr code/i })).toBeTruthy();
  expect(
    screen.getByRole('link', { name: /open wallet interaction/i }),
  ).toBeTruthy();
  expect(screen.getByRole('status').textContent).toMatch(
    /waiting for your wallet/i,
  );
});

test('opens a disclosure tab before requesting the next verification step', async () => {
  const user = userEvent.setup();
  const openedTab = { location: { href: '' }, close: () => {} };
  const originalOpen = window.open;
  let opened = false;
  window.open = () => {
    opened = true;
    return openedTab;
  };
  const nextInteraction = {
    ...interaction,
    state: 'DISCLOSING',
    redirectUrl: 'https://hub.example.test/disclose',
    qrValue: 'velocity-network://inspect/request-2',
  };
  render(
    <WaitingPage
      api={{
        getRun: async () => ({
          runId: 'run-1',
          capability: 'VERIFICATION',
          state: 'PREPARING_DISCLOSURE',
          setupCredential: { jwt: 'setup.jwt' },
        }),
        startRun: async () => {
          expect(opened).toEqual(true);
          return nextInteraction;
        },
      }}
      runId="run-1"
      initialRun={{
        interactionToken: 'interaction-token',
        capability: 'VERIFICATION',
        interaction,
      }}
    />,
  );

  await user.click(
    await screen.findByRole('button', { name: /continue to verification/i }),
  );

  expect(openedTab.location.href).toEqual(nextInteraction.redirectUrl);
  expect(
    await screen.findByRole('heading', { name: /share the setup badge/i }),
  ).toBeTruthy();
  window.open = originalOpen;
});
