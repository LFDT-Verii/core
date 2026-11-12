const {
  getSubjectNetPrefix,
} = require('../../organizations/domains/get-subject-net-prefix');

const inviteeInvitationEmail = async (
  { inviterOrganization, inviteeEmail, uri },
  context,
) => ({
  subject: await context.renderTemplate('invitee-invitation-email-subject', {
    inviterOrganization,
    netPrefix: getSubjectNetPrefix(context.config),
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
