const deleteTenantExtension = (parent) => ({
  deleteTenant: async (did) => {
    return parent
      .collection()
      .findOneAndUpdate(
        { dids: did },
        { $pull: { dids: did }, $set: { updatedAt: new Date() } }
      );
  },
  extensions: parent.extensions.concat(['deleteTenant']),
});

module.exports = { deleteTenantExtension };
