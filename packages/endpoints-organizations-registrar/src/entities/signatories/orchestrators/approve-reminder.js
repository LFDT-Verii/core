const { SignatoryEventStatus } = require('../domain');
const { ConsentTypes } = require('../../registrar-consents');

const approveReminder = async (organization, req) => {
  const { repos, config } = req;
  const currentTime = new Date();
  await repos.signatoryStatus.addState(
    { organizationId: organization._id },
    SignatoryEventStatus.APPROVED,
    {
      approvedAt: currentTime,
    }
  );
  await repos.registrarConsents.registerConsent({
    userId: organization.profile.signatoryEmail,
    organizationId: organization._id,
    type: ConsentTypes.Signatory,
    version: config.signatoryConsentVersion,
  });
};

module.exports = {
  approveReminder,
};
