const softDeleteOrganization = async (organization, { repos }) => {
  const did = organization.didDoc.id;
  const now = new Date();

  // hide the organization first: every organization finder excludes deleted
  // records, so a failure in the group cleanup below leaves nothing visible
  const deletedOrganization = await repos.organizations.update(
    organization._id,
    { deletedAt: now },
  );

  await repos.groups
    .collection()
    .updateMany(
      { dids: did },
      { $pull: { dids: did }, $set: { updatedAt: now } },
    );

  // a group created for the organization alone has no other members left;
  // removing it lets a retried registration create it again
  await repos.groups.collection().deleteMany({
    dids: { $size: 0 },
    $or: [
      { clientAdminIds: { $exists: false } },
      { clientAdminIds: { $size: 0 } },
    ],
  });

  return deletedOrganization;
};

module.exports = { softDeleteOrganization };
