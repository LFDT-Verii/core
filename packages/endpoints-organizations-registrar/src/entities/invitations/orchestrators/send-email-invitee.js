const { buildInvitationUrl, inviteeInvitationEmail } = require('../domains');

const initSendEmailInvitee = (fastify) => {
  const { sendEmail, sendError } = fastify;

  return async (
    { ticket, inviteeEmail, inviterOrganization, code },
    context
  ) => {
    try {
      const uri = buildInvitationUrl({ code, ticket }, context);

      await sendEmail(
        await inviteeInvitationEmail(
          {
            inviteeEmail,
            inviterOrganization,
            uri,
          },
          context
        )
      );
      return 'invitation_sent';
    } catch (error) {
      const message = 'Unable to send invitation email to user';
      const messageContext = { err: error, email: inviteeEmail };
      context.log.error(messageContext, message);
      sendError(error, { ...messageContext, message });
      return 'invitation_not_sent';
    }
  };
};

module.exports = {
  initSendEmailInvitee,
};
