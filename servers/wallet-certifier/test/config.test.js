const { describe, it } = require('node:test');
const { expect } = require('expect');
const { loadConfig } = require('../src/config');

const requiredEnvironment = Object.freeze({
  PUBLIC_APP_URL: 'https://certifier.example.test',
  WALLET_REGISTRATION_URL: 'https://registrar.example.test',
  REGISTRAR_URL: 'https://registrar-api.example.test',
  CREDENTIALING_HUB_URL: 'https://hub.example.test',
  CREDENTIALING_HUB_TENANT_ID: 'tenant-1',
  CREDENTIALING_HUB_ISSUER_SERVICE_ID: 'issuer-1',
  CREDENTIALING_HUB_RELYING_PARTY_SERVICE_ID: 'relying-party-1',
  SENDER_EMAIL: 'sender@example.test',
  BADGE_ACHIEVEMENT_ID: 'https://certifier.example.test/achievement',
});

describe('wallet certifier configuration', () => {
  it('requires the environment to supply the support address', () => {
    expect(() => loadConfig(requiredEnvironment)).toThrow(
      'SUPPORT_EMAIL is required',
    );
  });

  it('uses the support address supplied by the environment', () => {
    expect(
      loadConfig({
        ...requiredEnvironment,
        SUPPORT_EMAIL: 'support@example.test',
      }).supportEmail,
    ).toEqual('support@example.test');
  });
});
