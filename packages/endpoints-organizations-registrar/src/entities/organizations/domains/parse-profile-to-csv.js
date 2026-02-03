const { parseToCsv } = require('@verii/csv-parser');
const { join, isNil, omitBy, flow, reject } = require('lodash/fp');
const { Authorities } = require('./constants');

const parseProfileToCsv = async (organizationProfile) => {
  const csvFile = await parseToCsv(
    [
      flow(omitBy(isNil), (profile) => ({
        ...profile,
        ...buildPermittedVelocityServiceCategory(profile),
        ...removeLinkedInRegistrationNumber(profile),
      }))(organizationProfile),
    ],
    ['registrationNumbers', 'commercialEntities'],
  );
  return csvFile;
};

const buildPermittedVelocityServiceCategory = (profile) => {
  const obj = {};
  if (profile?.permittedVelocityServiceCategory != null) {
    obj.permittedVelocityServiceCategory = join(
      ', ',
      profile.permittedVelocityServiceCategory,
    );
  }
  return obj;
};

const removeLinkedInRegistrationNumber = (profile) => {
  return {
    registrationNumbers: reject(
      { authority: Authorities.LinkedIn },
      profile.registrationNumbers,
    ),
  };
};

module.exports = {
  parseProfileToCsv,
};
