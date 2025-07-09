const { split, isEmpty } = require('lodash/fp');

const getGivenFamilyNameFromName = (inviteeProfileName) => {
  const [givenName, familyName] = split(' ', inviteeProfileName);

  if (isEmpty(familyName)) {
    return {
      givenName,
    };
  }

  return {
    givenName,
    familyName,
  };
};

module.exports = {
  getGivenFamilyNameFromName,
};
