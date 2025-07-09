const titleMap = {
  approve: 'Approval',
  reject: 'Rejection',
};

const messageMap = {
  approve: 'approved',
  reject: 'rejected',
};

const signatoryApproveOrganizationEmail = (
  {
    organization: {
      profile: { name, signatoryGivenName, signatoryFamilyName },
    },
    response,
  },
  { config }
) => ({
  subject: `${titleMap[response]} of registration by ${name}`,
  // eslint-disable-next-line max-len
  message: `${signatoryGivenName} ${signatoryFamilyName} ${messageMap[response]} the approval request of the registration of ${name} to the Velocity Network.`,
  sender: config.noReplyEmail,
  recipients: [config.registrarSupportEmail],
});

module.exports = {
  signatoryApproveOrganizationEmail,
};
