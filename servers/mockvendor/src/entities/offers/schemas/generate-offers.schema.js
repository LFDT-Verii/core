const {
  newVendorOfferSchema,
} = require('@verii/server-credentialagent/src/controllers/operator/tenants/_tenantId/offers/schemas');
const { filter, omit } = require('lodash/fp');

module.exports = (context) => ({
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://velocitycareerlabs.io/generate-offers.schema.json',
  title: 'generate-offers',
  description:
    'A generate offers, is the same as a regular new-vendor-offer, but without required param offer id',
  type: 'object',
  additionalProperties: false,
  properties: {
    ...omit(
      ['offerCreationDate', 'offerExpirationDate'],
      newVendorOfferSchema.properties,
    ),
  },
  required: [
    ...filter(
      [
        'type',
        'credentialSubject',
        ...(context.config.omitOfferId ? [] : ['offerId']),
      ],
      newVendorOfferSchema.required,
    ),
  ],
});
