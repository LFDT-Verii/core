const { omit } = require('lodash/fp');

const transformDidFilter = (filter) => {
  const key = 'didDoc.id';
  const val = filter[key];

  return {
    ...omit([key], filter),
    $or: [{ [key]: val }, { 'didDoc.alsoKnownAs': val }],
  };
};

module.exports = { transformDidFilter };
