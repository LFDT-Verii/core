const newError = require('http-errors');

const findGroupOrError = async (id, req) => {
  const { repos } = req;
  try {
    return await repos.groups.findById(id);
  } catch {
    throw newError(404, 'Group does not exist', {
      errorCode: 'group_does_not_exist',
    });
  }
};

module.exports = {
  findGroupOrError,
};
