import { test } from 'node:test';
import { expect } from 'expect';
import { render, screen, within } from '@testing-library/react';
import React from 'react';
import ResultPage from './ResultPage.jsx';

const checks = {
  tamper: 'PASS',
  trustedIssuer: 'PASS',
  trustedHolder: 'NOT_APPLICABLE',
  revocation: 'PASS',
  expiry: 'PASS',
};

test('renders one verified dot and inline evidence for an issuing result', () => {
  render(
    <ResultPage
      run={{
        runId: 'run-1',
        capability: 'ISSUING',
        state: 'PASSED',
        result: {
          passed: true,
          completedAt: '2026-07-21T01:05:00.000Z',
          credential: {
            issuedAt: '2026-07-21T01:04:30.000Z',
            json: { type: ['OpenBadgeCredential'] },
            jwt: 'issued.jwt.value',
          },
        },
      }}
    />,
  );

  const status = screen
    .getByText('Credential issued')
    .closest('.verified-line');
  expect(status.querySelectorAll('.status-dot')).toHaveLength(1);
  expect(
    within(screen.getByTestId('credential-result-1')).getByText(
      /OpenBadgeCredential/,
    ),
  ).toBeTruthy();
  expect(screen.getByText('issued.jwt.value')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /show json|show jwt/i })).toEqual(
    null,
  );
});

test('renders presentation status and every credential check without duplicate dots', () => {
  render(
    <ResultPage
      run={{
        runId: 'run-2',
        capability: 'VERIFICATION',
        state: 'PASSED',
        result: {
          passed: true,
          setupBadgePresent: true,
          completedAt: '2026-07-21T01:05:00.000Z',
          presentation: { verified: true, checks: { tamper: 'PASS' } },
          credentials: [
            {
              format: 'JWT_VC',
              json: { type: ['OpenBadgeCredential'] },
              jwt: 'setup.jwt',
              verified: true,
              checks,
            },
            {
              format: 'JWT_VC',
              json: { type: ['EmploymentCredential'] },
              jwt: 'other.jwt',
              verified: true,
              checks,
            },
          ],
        },
      }}
    />,
  );

  const presentation = screen
    .getByText('Presentation verified')
    .closest('.verified-line');
  expect(presentation.querySelectorAll('.status-dot')).toHaveLength(1);
  const credentialHeadings = screen.getAllByText('Credential verified');
  expect(credentialHeadings).toHaveLength(2);
  for (const heading of credentialHeadings) {
    expect(
      heading.closest('.verified-line').querySelectorAll('.status-dot'),
    ).toHaveLength(1);
  }
  const firstCredential = screen.getByTestId('credential-result-1');
  expect(within(firstCredential).getByText('Tamper')).toBeTruthy();
  expect(within(firstCredential).getByText('Not applicable')).toBeTruthy();
  expect(screen.getByText('setup.jwt')).toBeTruthy();
  expect(screen.getByText('other.jwt')).toBeTruthy();
});

test('associates each evidence section with unique headings', () => {
  const { container } = render(
    <ResultPage
      run={{
        runId: 'run-2',
        capability: 'VERIFICATION',
        state: 'PASSED',
        result: {
          passed: true,
          setupBadgePresent: true,
          completedAt: '2026-07-21T01:05:00.000Z',
          presentation: { verified: true, checks: { tamper: 'PASS' } },
          credentials: [
            {
              format: 'JWT_VC',
              json: { type: ['OpenBadgeCredential'] },
              jwt: 'setup.jwt',
              verified: true,
              checks,
            },
            {
              format: 'JWT_VC',
              json: { type: ['EmploymentCredential'] },
              jwt: 'other.jwt',
              verified: true,
              checks,
            },
          ],
        },
      }}
    />,
  );

  const evidenceSections = [
    ...container.querySelectorAll('.evidence-section section'),
  ];
  const headingIds = evidenceSections.map((section) =>
    section.getAttribute('aria-labelledby'),
  );

  expect(new Set(headingIds).size).toEqual(evidenceSections.length);
  for (const section of evidenceSections) {
    expect(section.querySelector('h4').id).toEqual(
      section.getAttribute('aria-labelledby'),
    );
  }
});

test('renders terminal failure guidance and a new-test action', () => {
  render(
    <ResultPage
      run={{
        runId: 'run-3',
        capability: 'ISSUING',
        state: 'REJECTED',
        failure: {
          code: 'credential_rejected',
          message: 'The credential was rejected by the wallet user.',
        },
      }}
    />,
  );

  expect(
    screen.getByRole('heading', { name: /certification not completed/i }),
  ).toBeTruthy();
  expect(screen.getByText(/rejected by the wallet user/i)).toBeTruthy();
  expect(
    screen.getByRole('link', { name: /start another test/i }),
  ).toBeTruthy();
});
