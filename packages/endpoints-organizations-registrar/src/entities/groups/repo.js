const {
  repoFactory,
  autoboxIdsExtension,
} = require('@spencejs/spence-mongo-repos');
const newError = require('http-errors');

module.exports = (app, options, next = () => {}) => {
  next();
  return repoFactory(
    {
      name: 'groups',
      entityName: 'group',
      defaultProjection: {
        _id: 1,
        groupId: 1,
        dids: 1,
        clientAdminIds: 1,
        createdAt: 1,
        updatedAt: 1,
      },
      extensions: [autoboxIdsExtension, findersExtension, modifiersExtensions],
    },
    app
  );
};

const findersExtension = (parent) => ({
  findGroupByDid: async (did) => {
    return parent.findOne({
      filter: {
        dids: did,
      },
    });
  },
  findGroupByGroupId: async (groupId) => {
    const group = await parent.findOne({
      filter: {
        groupId,
      },
    });
    if (group == null) {
      throw newError.NotFound(`Group ${groupId} not found`);
    }
    return group;
  },
  findGroupByUserIdAndDid: async (userId, did) => {
    return parent.findOne({
      filter: {
        clientAdminIds: userId,
        dids: did,
      },
    });
  },
  findGroupByUserId: async (userId) => {
    return parent.findOne({
      filter: {
        clientAdminIds: userId,
      },
    });
  },
  extensions: parent.extensions.concat(['findersExtension']),
});

const modifiersExtensions = (parent) => {
  const createGroup = async (groupId, userId) => {
    const group = { groupId, dids: [groupId] };
    if (userId != null) {
      group.clientAdminIds = [userId];
    }
    return parent.insert(group);
  };
  const addDidToGroupOfUser = async (userId, did) => {
    return parent.collection().updateOne(
      {
        clientAdminIds: userId,
      },
      {
        $push: {
          dids: did,
        },
        $set: {
          updatedAt: new Date(),
        },
      }
    );
  };
  const addUserToGroupClientAdmins = async (groupId, userId) => {
    const { clientAdminIds } = await parent.findGroupByGroupId(groupId);
    if (clientAdminIds.includes(userId)) {
      return undefined;
    }
    return parent.collection().updateOne(
      {
        groupId,
      },
      {
        $push: {
          clientAdminIds: userId,
        },
        $set: {
          updatedAt: new Date(),
        },
      }
    );
  };

  const addNewDidOfUser = async (did, userId) => {
    const existingGroup = await parent.findGroupByUserId(userId);
    if (existingGroup) {
      return addDidToGroupOfUser(userId, did);
    }
    return createGroup(did, userId);
  };

  return {
    createGroup,
    addNewDidOfUser,
    addUserToGroupClientAdmins,
    addDidToGroupOfUser,
    extensions: parent.extensions.concat(['modifiersExtensions']),
  };
};
