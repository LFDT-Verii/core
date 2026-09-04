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

  // the group provisioned for the organization itself is keyed by its did;
  // once it holds no other dids and no client admins, remove it so a retried
  // registration can create it again instead of inserting a duplicate
  await repos.groups.collection().deleteMany({
    groupId: did,
    dids: { $size: 0 },
    $or: [
      { clientAdminIds: { $exists: false } },
      { clientAdminIds: { $size: 0 } },
    ],
  });

  return deletedOrganization;
};

module.exports = { softDeleteOrganization };
