const { isInvitationExpired } = require('../domains');

const acceptInvitation = async (invitationCode, ctx) => {
  const { repos, log, user } = ctx;
  if (!invitationCode) {
    return undefined;
  }
  const invitation = await repos.invitations.findOne({
    filter: { code: invitationCode },
  });
  if (!invitation) {
    log.warn({ invitationCode }, 'unable to accept invalid invitation');
    return undefined;
  }
  if (isInvitationExpired(invitation)) {
    log.warn({ invitationCode }, 'unable to accept expired invitation');
    return undefined;
  }
  return repos.invitations.update(invitation._id, {
    acceptedAt: new Date(),
    acceptedBy: user.sub,
  });
};
module.exports = { acceptInvitation };
