const { w3cVcSchema } = require('@verii/common-schemas');

const newVendorOfferSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://velocitycareerlabs.io/new-vendor-offer.schema.json',
  type: 'object',
  title: 'new-vendor-offer',
  description:
    'An offer is similar to a credential but is never wrapped in a JWT and hence doesnt carry the JWS (digital signature)',
  additionalProperties: false,
  properties: {
    ...w3cVcSchema.properties,
    credentialSubject: {
      type: 'object',
      description: 'Contains all the claims of the credential',
      additionalProperties: true,
      required: ['vendorUserId'],
      properties: {
        vendorUserId: {
          type: 'string',
          description:
            // eslint-disable-next-line max-len
            "The vendor's id for the person. This is only used to communicate to the vendor's api and is never shared with external parties or the velocity network.",
        },
      },
    },
    offerCreationDate: {
      type: 'string',
      format: 'date-time',
      deprecated: true,
    },
    offerExpirationDate: {
      type: 'string',
      format: 'date-time',
      deprecated: true,
    },
    offerId: {
      type: 'string',
    },
    exchangeId: {
      type: 'string',
    },
  },
  required: ['offerId', ...w3cVcSchema.required],
};

module.exports = newVendorOfferSchema;
