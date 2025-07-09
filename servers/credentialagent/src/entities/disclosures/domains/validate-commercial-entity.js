const { some, isEmpty } = require('lodash/fp');
const newError = require('http-errors');

const validateCommercialEntity = (disclosure, verifiedProfile) => {
  const { commercialEntityName, commercialEntityLogo } = disclosure;

  if (isEmpty(commercialEntityName) && isEmpty(commercialEntityLogo)) {
    return;
  }

  if (
    !some(
      ({ name, logo }) =>
        name === commercialEntityName && logo === commercialEntityLogo,
      verifiedProfile?.credentialSubject?.commercialEntities || []
    )
  ) {
    const errorCode = 'invalid_commercial_entity';
    const errorMessage = 'Invalid commercial entity';
    throw newError(400, errorMessage, { errorCode });
  }
};

module.exports = {
  validateCommercialEntity,
};
