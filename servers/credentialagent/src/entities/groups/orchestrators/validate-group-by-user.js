const { isEmpty } = require('lodash/fp');
const { findGroupOrError } = require('./find-group-or-error');

const validateGroupByUser = async (context) => {
  const { user } = context;

  if (isEmpty(user.groupId)) {
    return;
  }

  await findGroupOrError(user.groupId, context);
};

module.exports = {
  validateGroupByUser,
};
