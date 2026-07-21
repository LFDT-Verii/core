const buildSetupBadge = ({
  organizationName,
  applicantName,
  applicantEmail,
  walletName,
  achievementId,
  imageUrl,
  criteriaUrl,
}) => ({
  type: ['OpenBadgeCredential'],
  name: `${walletName} certification setup badge`,
  credentialSubject: {
    type: ['AchievementSubject'],
    identifier: [
      {
        type: ['IdentityObject'],
        hashed: false,
        identityHash: applicantEmail,
        identityType: 'emailAddress',
      },
    ],
    achievement: {
      id: achievementId,
      type: ['Achievement'],
      name: `${walletName} certification setup badge`,
      description: `${applicantName} is testing ${walletName} with ${organizationName}.`,
      criteria: {
        type: ['Criteria'],
        ...(criteriaUrl ? { id: criteriaUrl } : {}),
        narrative: `Issued by ${organizationName} as the setup credential for wallet certification.`,
      },
      ...(imageUrl ? { image: { type: 'Image', id: imageUrl } } : {}),
    },
  },
});

module.exports = { buildSetupBadge };
