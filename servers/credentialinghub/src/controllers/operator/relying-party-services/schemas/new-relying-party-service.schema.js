const newRelyingPartyServiceSchema = {
  title: 'new-relying-party-service',
  $id: 'new-relying-party-service',
  type: 'object',
  description: 'The relying-party service describes how issuer is setup',
  additionalProperties: false,
  required: ['mode', 'velocityNetworkServiceId', 'termsUrl'],
  properties: {
    mode: {
      type: 'string',
      enum: ['single', 'feed'],
      default: 'single',
      description: 'Single (default) deliveries or a feed',
    },
    velocityNetworkServiceId: {
      type: 'string',
      description: 'Velocity Network Service Id',
    },
    description: {
      type: 'string',
      description: 'Description field for the disclosure flow',
    },
    termsUrl: {
      type: 'string',
      description:
        'link to a online terms and conditions for issuer or disclosure',
      format: 'uri',
    },
    disclosureRequest: {
      type: 'object',
      description:
        'Required if `identificationMethod` contains `verifiable_presentation`',
      required: ['types', 'purpose', 'retentionPeriod'],
      properties: {
        types: {
          type: 'array',
          description: 'the set of types that are to be disclosed.',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                description: 'The credential type to be disclosed',
              },
            },
          },
        },
        purpose: {
          type: 'string',
          description:
            // eslint-disable-next-line max-len
            'purpose is a summary of the description\n\n*required*, if the `configurationType` is `inspection` or the `identificationMode` is `verifiable_presentation`',
        },
        retentionPeriod: {
          type: 'string',
          description:
            // eslint-disable-next-line max-len
            '*required*, if the `configurationType` is `inspection` or the `identificationMode` is `verifiable_presentation`\n\nLength of time the disclosure agreement will last.  Duration can be any length of time.\n\nFollows the ISO 8601 standard on durations for time intervals.\n\nFormat:\n\nPxYxMxWxD\n\nWhere:\nx = an integer\nY = Years\nM = Months\nW = Weeks\nD = Days\n\nA valid format requires "P" plus at least one integer and time unit.\n\nExamples: \nP60D = 60 days\nP1Y30D = 1 year and 30 days.',
          format: 'duration',
        },
      },
    },
    presentationDefinition: {
      type: 'object',
      description:
        'A spec compliant presentation definition. https://identity.foundation/presentation-exchange/#presentation-definition',
      additionalProperties: true,
    },
    deactivationDate: {
      type: 'string',
      format: 'date-time',
      description:
        'can be configured to deactivate at a predetermined time or to be deactivated on demand by setting this to now',
    },
    authTokensExpireIn: {
      type: 'integer',
      minimum: 1,
      default: 604800,
    },
    presentationRequestsExpireIn: {
      type: 'integer',
      minimum: 1,
      default: 600,
      description:
        'how many seconds before presentation requests issued by this service expire. Default is 10 minutes',
    },
  },
};

module.exports = newRelyingPartyServiceSchema;
