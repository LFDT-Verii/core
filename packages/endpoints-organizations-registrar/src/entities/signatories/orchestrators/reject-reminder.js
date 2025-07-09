const { SignatoryEventStatus } = require('../domain');

const rejectReminder = async (organization, req) => {
  const { repos } = req;
  const currentTime = new Date();
  await repos.signatoryStatus.addState(
    { organizationId: organization._id },
    SignatoryEventStatus.REJECTED,
    {
      rejectedAt: currentTime,
    }
  );
};

module.exports = {
  rejectReminder,
};
