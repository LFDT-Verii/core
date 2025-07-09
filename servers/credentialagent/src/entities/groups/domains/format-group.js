const { omit } = require('lodash/fp');

const formatGroup = (group) => ({
  ...omit(['_id'], group),
  did: group._id,
  id: group._id,
});

module.exports = {
  formatGroup,
};
