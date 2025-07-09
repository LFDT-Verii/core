const { validateCommercialEntity } = require('./validate-commercial-entity');
const {
  validateByIdentificationMethod,
} = require('./validate-by-identification-method');
const {
  validateDisclosureByConfigurationType,
} = require('./validate-disclosure-by-configuration-type');
const {
  validateDisclosureDefaultIssuing,
} = require('./validate-disclosure-default-issuing');
const { validateVendorEndpoint } = require('./validate-vendor-endpoint');
const { validateVendorWebhook } = require('./validate-vendor-webhook');
const {
  validatePresentationDefinition,
} = require('./validate-presentation-definition');
const { validateFeed } = require('./validate-feed');

const validateDisclosure = (
  disclosure,
  verifiedProfile,
  setIssuingDefault,
  context
) => {
  const { tenant } = context;
  validateVendorWebhook(tenant, context);
  validateDisclosureByConfigurationType(disclosure);
  validateDisclosureDefaultIssuing(disclosure, tenant, setIssuingDefault);
  validateByIdentificationMethod(disclosure, setIssuingDefault);
  validateVendorEndpoint(disclosure);
  validateCommercialEntity(disclosure, verifiedProfile);
  validatePresentationDefinition(disclosure);
  validateFeed(disclosure);
};

module.exports = {
  validateDisclosure,
};
