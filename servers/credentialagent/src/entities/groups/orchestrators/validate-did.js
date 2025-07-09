const { isEmpty } = require('lodash/fp');
const newError = require('http-errors');

const validateDid = async (id, did, context) => {
  const { repos } = context;
  const group = await repos.groups.findOne({
    filter: {
      _id: { $ne: id },
      dids: did,
    },
  });

  if (isEmpty(group)) {
    return;
  }

  throw newError(400, 'Did already linked to a group', {
    errorCode: 'did_already_in_group',
  });
};

module.exports = {
  validateDid,
};
