const newIssuerServiceSchema = {
  title: 'new-issuer-service',
  $id: 'new-issuer-service',
  type: 'object',
  description: 'The issuer service describes how issuer is setup',
  additionalProperties: false,
  required: ['velocityNetworkServiceId', 'termsUrl', 'authMethods', 'authMode'],
  properties: {
    velocityNetworkServiceId: {
      type: 'string',
      description: 'Velocity Network Service Id',
    },
    description: {
      type: 'string',
      description: 'Description field for the issuer flow',
    },
    termsUrl: {
      type: 'string',
      description:
        'link to a online terms and coniditions for issuer or disclosure',
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
      type: 'number',
      default: 604800,
    },
    authMethods: {
      type: 'array',
      minItems: 1,
      description:
        // eslint-disable-next-line max-len
        'the auth method indicates what authentication method(s) are supported for issuer. To use `preauth` requires the issuer to include a `vendorOriginContext` in the deep link. `verifiable_presentation` requires a `disclosureRequest` or `presentationDefinition` to be specified.\nIn the future an issuer will be able to use both methods in one disclosure\n`authMethods` is required with at least one entry ',
      items: {
        type: 'string',
        enum: ['preauth', 'verifiable_presentation'],
      },
    },
    authMode: {
      enum: ['internal'],
      description: 'the auth mode. Currently only `internal` is supported',
    },
    verifiablePresentationAuthRules: {
      description:
        // eslint-disable-next-line max-len
        'verifiablePresentationAuthRules are the matcher rules that can be used to match an exchange with submitted presentation used for authentication. Required when the authMethods include `verifiable_presentation` and the authMode is `internal`',
      type: 'array',
      items: {
        type: 'object',
        required: ['path', 'rule', 'valueIndex'],
        properties: {
          path: {
            type: 'array',
            description: 'json path(s) to resolve in order',
            items: {
              type: 'string',
            },
          },
          rule: {
            type: 'string',
            description: 'the rule to run. ONly pick is supported right ow',
            enum: ['pick', 'equal'],
          },
          valueIndex: {
            type: 'integer',
            description:
              'the index to use with in a data row in values. Value must return true when compared using ===',
          },
        },
      },
    },
    challengesExpireIn: {
      type: 'number',
      default: 600,
      description:
        'how many seconds before challenges issued by this service expire. Default is 10 minutes',
    },
    credentialTypesAvailable: {
      type: 'array',
      description: 'the types of credentials available from this service',
      items: {
        type: 'string',
      },
    },
    autoCleanPII: {
      type: 'boolean',
    },
  },
};

module.exports = newIssuerServiceSchema;
