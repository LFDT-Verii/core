const w3cVcSchema = require('./w3c-vc.schema.json');

const holderOfferSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://velocitycareerlabs.io/holder-offer.schema.json',
  type: 'object',
  description:
    'An offer is similar to a credential but is never encoded as a JWT as it doesnt carry the digital signature.',
  additionalProperties: false,
  properties: {
    ...w3cVcSchema.properties,
    issuer: {
      oneOf: [
        {
          type: 'object',
          additionalProperties: true,
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'the did id for the issuer.',
            },
            type: {
              oneOf: [
                {
                  type: 'string',
                  description: 'the type of the issuer property',
                },
                {
                  type: 'array',
                  items: { type: 'string' },
                },
              ],
            },
            name: {
              type: 'string',
            },
            image: {
              type: 'string',
            },
          },
        },
        {
          type: 'string',
        },
      ],
    },
    credentialSchema: {
      oneOf: [
        {
          type: 'object',
          description: 'Contains all the claims of the credential',
          properties: {
            type: {
              type: 'string',
            },
            id: {
              type: 'string',
              format: 'uri',
            },
          },
          required: ['type', 'id'],
        },
        {
          type: 'array',
          items: {
            type: 'object',
            description: 'Contains all the claims of the credential',
            properties: {
              type: {
                type: 'string',
              },
              id: {
                type: 'string',
                format: 'uri',
              },
            },
            required: ['type', 'id'],
          },
        },
      ],
    },
    offerCreationDate: {
      type: 'string',
      format: 'date-time',
    },
    offerExpirationDate: {
      type: 'string',
      format: 'date-time',
    },
    offerId: {
      type: 'string',
    },
    id: {
      type: 'string',
    },
    exchangeId: {
      type: 'string',
    },
    hash: {
      type: 'string',
    },
    linkedCredentials: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          linkCode: {
            type: 'string',
          },
          linkType: {
            type: 'string',
            enum: ['REPLACE'],
          },
        },
        required: ['linkCode', 'linkType'],
      },
    },
  },
  required: ['issuer', 'hash', ...w3cVcSchema.required],
};

module.exports = { holderOfferSchema };
