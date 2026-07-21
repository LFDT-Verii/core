const { describe, it } = require('node:test');
const { expect } = require('expect');
const {
  hashCapability,
  verifyCapability,
} = require('../../src/domain/capabilities');
const { fingerprintJwt } = require('../../src/domain/evidence');

describe('sensitive value fingerprints', () => {
  it('creates deterministic peppered capability hashes', () => {
    expect(hashCapability('secret-token', 'server-pepper')).toEqual(
      hashCapability('secret-token', 'server-pepper'),
    );
    expect(hashCapability('secret-token', 'server-pepper')).not.toEqual(
      hashCapability('secret-token', 'other-pepper'),
    );
    expect(hashCapability('secret-token', 'server-pepper')).not.toContain(
      'secret-token',
    );
  });

  it('verifies capabilities without storing the plaintext token', () => {
    const expectedHash = hashCapability('secret-token', 'server-pepper');

    expect(
      verifyCapability('secret-token', 'server-pepper', expectedHash),
    ).toEqual(true);
    expect(
      verifyCapability('wrong-token', 'server-pepper', expectedHash),
    ).toEqual(false);
  });

  it('fingerprints credential JWTs deterministically', () => {
    expect(fingerprintJwt('header.payload.signature')).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(fingerprintJwt('header.payload.signature')).toEqual(
      fingerprintJwt('header.payload.signature'),
    );
    expect(fingerprintJwt('other.jwt')).not.toEqual(
      fingerprintJwt('header.payload.signature'),
    );
  });
});
