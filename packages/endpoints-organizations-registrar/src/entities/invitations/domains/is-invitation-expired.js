const isInvitationExpired = (invitation) => invitation.expiresAt < new Date();

module.exports = {
  isInvitationExpired,
};
