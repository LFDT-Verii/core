const { describe, it } = require('node:test');
const { expect } = require('expect');
const { fingerprintJwt } = require('../../src/domain/evidence');
const { evaluateVerification } = require('../../src/domain/results');

const passingInput = () => ({
  presentation: { verified: true },
  setupFingerprint: fingerprintJwt('setup.jwt'),
  credentials: [
    { jwt: 'setup.jwt', verified: true, checks: { tamper: 'PASS' } },
    {
      jwt: 'other.jwt',
      verified: true,
      checks: { expiry: 'PASS', revocation: 'NOT_APPLICABLE' },
    },
  ],
});

describe('verification result evaluation', () => {
  it('passes a verified presentation containing the exact setup badge', () => {
    expect(evaluateVerification(passingInput())).toEqual({
      passed: true,
      setupBadgePresent: true,
    });
  });

  it('fails when the exact setup badge is absent', () => {
    const input = passingInput();
    input.credentials = [input.credentials[1]];

    expect(evaluateVerification(input)).toEqual({
      passed: false,
      setupBadgePresent: false,
    });
  });

  it('fails when the presentation is not verified', () => {
    const input = passingInput();
    input.presentation.verified = false;

    expect(evaluateVerification(input)).toEqual({
      passed: false,
      setupBadgePresent: true,
    });
  });

  it('fails when the setup badge has a failed check', () => {
    const input = passingInput();
    input.credentials[0].checks.tamper = 'FAIL';

    expect(evaluateVerification(input).passed).toEqual(false);
  });

  it('fails when an additional credential has a failed check', () => {
    const input = passingInput();
    input.credentials[1].checks.expiry = 'FAIL';

    expect(evaluateVerification(input).passed).toEqual(false);
  });

  it('fails when any credential is not verified', () => {
    const input = passingInput();
    input.credentials[1].verified = false;

    expect(evaluateVerification(input).passed).toEqual(false);
  });
});
