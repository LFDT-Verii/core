const {
  newVendorOfferSchema,
} = require('@verii/server-credentialagent/src/controllers/operator/tenants/_tenantId/offers/schemas');
const { filter, omit } = require('lodash/fp');

module.exports = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://velocitycareerlabs.io/new-mockvendor-offer.schema.json',
  title: 'new-mockvendor-offer',
  description:
    'An new mockvendor offer, is the same as a regular new-vendor-offer, but with the issuer specified',
  type: 'object',
  additionalProperties: false,
  properties: {
    ...omit(
      ['offerCreationDate', 'offerExpirationDate'],
      newVendorOfferSchema.properties,
    ),
    label: { type: 'string' },
  },
  required: [...filter(['offerId'], newVendorOfferSchema.required), 'issuer'],
};
