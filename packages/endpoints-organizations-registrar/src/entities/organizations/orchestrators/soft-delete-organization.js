const { map } = require('lodash/fp');

const softDeleteOrganization = async (organization, { repos }) => {
  const did = organization.didDoc.id;
  const groups = await repos.groups.find({ filter: { dids: did } });
  await repos.groups.collection().updateMany(
    { _id: { $in: map('_id', groups) } },
    {
      $pull: { dids: did },
      $set: { updatedAt: new Date() },
    },
  );

  return repos.organizations.update(organization._id, {
    deletedAt: new Date(),
  });
};

module.exports = { softDeleteOrganization };
