const { ServiceCategories } = require('@verii/organizations-registry');
const { includes, some } = require('lodash/fp');
const { CheckResults } = require('./check-results');

const checkIdentityIssuer = (permittedVelocityServiceCategory) => {
  if (
    some(
      (serviceCategory) =>
        includes(serviceCategory, permittedVelocityServiceCategory),
      [
        ServiceCategories.IdentityIssuer,
        ServiceCategories.NotaryIdDocumentIssuer,
        ServiceCategories.ContactIssuer,
        ServiceCategories.NotaryContactIssuer,
        ServiceCategories.IdDocumentIssuer,
      ]
    )
  ) {
    return CheckResults.PASS;
  }
  throw new Error('issuer_requires_identity_permission');
};

module.exports = {
  checkIdentityIssuer,
};
