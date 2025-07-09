/* eslint-disable max-len */
const { reduce, compact } = require('lodash/fp');

const renderInviteTextTokenWalletRole = (
  tokenWalletRole,
  organizations,
  config
) => {
  const hasRole = compact(tokenWalletRole).length;

  if (!hasRole) {
    return '';
  }

  return `To access the Payment and Rewards Hub, please follow the link(s) below and use the credentials you just created to login.<br>
PLEASE NOTE - Access to the Payment and Rewards Hub will only be possible once your services are activated.<br>
${reduce(
  (text, org) =>
    `${text}<a href='${config.tokenWalletBaseUrl}/o/${org.didDoc.id}'>${org.profile.name}</a> <br>`,
  '',
  organizations
)}`;
};

const initUserRegistrarEmails = (config) => ({
  emailToUserForUserInvite: ({
    user,
    ticket,
    organizations = [],
    tokenWalletRole,
  }) => ({
    subject: 'Velocity Network Registrar Invitation',
    message: `${user.givenName} ${user.familyName},
Welcome to the Velocity Network Registrar.<br><br>
Please accept your invite and set your password at <a href='${ticket}'>${ticket}</a>
<br>
<br>
${renderInviteTextTokenWalletRole(tokenWalletRole, organizations, config)}
<br>
Regards,
<br>
<br>
The Velocity Network Registrar
`,
    sender: config.registrarSupportEmail,
    recipients: [user.email],
    replyTo: config.noReplyEmail,
    html: true,
  }),
});

module.exports = { initUserRegistrarEmails };
