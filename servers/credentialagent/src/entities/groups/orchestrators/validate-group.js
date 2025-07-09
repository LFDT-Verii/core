const { isEmpty, partition } = require('lodash/fp');
const newError = require('http-errors');

const validateGroup = async ({ slug, did }, context) => {
  const { repos } = context;
  const groups = await repos.groups.find({
    filter: {
      $or: [
        {
          slug,
        },
        {
          _id: did,
        },
      ],
    },
  });

  const [groupWithSlug, groupWithDid] = partition(
    (g) => g.slug === slug,
    groups
  );

  if (!isEmpty(groupWithSlug)) {
    throw newError(400, 'Group with the given SLUG already exists', {
      errorCode: 'slug_already_exist',
    });
  }

  if (!isEmpty(groupWithDid)) {
    throw newError(400, 'Group with the given DID already exists', {
      errorCode: 'did_already_exist',
    });
  }
};

module.exports = {
  validateGroup,
};
