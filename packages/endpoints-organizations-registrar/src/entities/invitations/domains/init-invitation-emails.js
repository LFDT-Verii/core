const inviteeInvitationEmail = async (
  { inviterOrganization, inviteeEmail, uri },
  context
) => ({
  subject: await context.renderTemplate('invitee-invitation-email-subject', {
    inviterOrganization,
  }),
  message: await context.renderTemplate('invitee-invitation-email-body', {
    inviterOrganization,
    uri,
  }),
  sender: context.config.registrarSupportEmail,
  recipients: [inviteeEmail],
  html: true,
});

module.exports = { inviteeInvitationEmail };
