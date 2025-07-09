const newError = require('http-errors');
const { isEmpty } = require('lodash/fp');

const validateOfferCommercialEntity = (offer, disclosure = {}) => {
  const { commercialEntityName, commercialEntityLogo } = disclosure;
  const { issuer } = offer;

  if (isEmpty(commercialEntityName) && isEmpty(commercialEntityLogo)) {
    return;
  }

  if (
    issuer?.name !== commercialEntityName ||
    issuer?.image !== commercialEntityLogo
  ) {
    const errorCode = 'invalid_commercial_entity';
    const errorMessage = 'Invalid commercial entity';
    throw newError(400, errorMessage, { errorCode });
  }
};

module.exports = {
  validateOfferCommercialEntity,
};
