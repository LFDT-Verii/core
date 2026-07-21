const { describe, it } = require('node:test');
const { expect } = require('expect');
const { buildSetupBadge } = require('../../src/domain/badge');

describe('setup badge', () => {
  it('builds a personalized OpenBadgeCredential for the selected wallet', () => {
    const badge = buildSetupBadge({
      organizationName: 'Velocity Network Foundation',
      applicantName: 'Alex Example',
      applicantEmail: 'alex@example.com',
      walletName: 'Acme Wallet',
      achievementId: 'https://example.test/achievements/wallet-certifier',
      imageUrl: 'https://example.test/badge.png',
      criteriaUrl: 'https://example.test/criteria',
    });

    expect(badge.type).toEqual(['OpenBadgeCredential']);
    expect(badge.name).toContain('Acme Wallet');
    expect(badge.credentialSubject).toEqual(
      expect.objectContaining({
        type: ['AchievementSubject'],
        identifier: [
          {
            type: ['IdentityObject'],
            hashed: false,
            identityHash: 'alex@example.com',
            identityType: 'emailAddress',
          },
        ],
      }),
    );
    expect(badge.credentialSubject.achievement).toEqual(
      expect.objectContaining({
        id: 'https://example.test/achievements/wallet-certifier',
        type: ['Achievement'],
        name: 'Acme Wallet certification setup badge',
        description: expect.stringContaining('Alex Example'),
        criteria: {
          type: ['Criteria'],
          id: 'https://example.test/criteria',
          narrative: expect.stringContaining('Velocity Network Foundation'),
        },
        image: {
          type: 'Image',
          id: 'https://example.test/badge.png',
        },
      }),
    );
  });

  it('omits optional image and criteria identifiers when unconfigured', () => {
    const badge = buildSetupBadge({
      organizationName: 'Velocity Network Foundation',
      applicantName: 'Alex Example',
      applicantEmail: 'alex@example.com',
      walletName: 'Acme Wallet',
      achievementId: 'https://example.test/achievements/wallet-certifier',
    });

    expect(badge.credentialSubject.achievement.image).toEqual(undefined);
    expect(badge.credentialSubject.achievement.criteria.id).toEqual(undefined);
  });
});
