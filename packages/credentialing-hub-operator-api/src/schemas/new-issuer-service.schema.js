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
        'Required when `authMethods` include `verifiable_presentation`',
      required: ['types', 'purpose', 'retentionPeriod'],
      properties: {
        types: {
          type: 'array',
          description: 'the set of types that are to be disclosed.',
          minItems: 1,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['type'],
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
        // eslint-disable-next-line max-len
        'A spec compliant presentation definition. https://identity.foundation/presentation-exchange/#presentation-definition. Not allowed when `authMethods` include `verifiable_presentation`',
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
        'the auth method indicates what authentication method(s) are supported for issuer. To use `preauth` requires the issuer to include a `vendorOriginContext` in the deep link. `verifiable_presentation` requires a `disclosureRequest` and at least one of `verifiablePresentationAuthRules`, and forbids a `presentationDefinition`.\nIn the future an issuer will be able to use both methods in one disclosure\n`authMethods` is required with at least one entry ',
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
        'verifiablePresentationAuthRules are the matcher rules that can be used to match an exchange with submitted presentation used for authentication. Required when the authMethods include `verifiable_presentation` and the authMode is `internal`. At most 10 rules.\n\nEach rule reads values of its `valueType` from the presented credentials of its `type`, and ignores values of any other type rather than converting them. Strings are trimmed and lower-cased, and numbers and booleans are used as they are. A depot matches when its `authValues`, normalized the same way, equal the values the rules read, each at its rule\'s `valueIndex`. Values of different types never match, so `"12345"` never matches `12345`.',
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        required: ['path', 'rule', 'valueIndex', 'type', 'valueType'],
        // valueFormat is only allowed on string rules. Each branch has its own
        // type because fast-json-stringify compiles them on their own for the
        // issuer-service response, and AJV's strictTypes logs untyped ones.
        anyOf: [
          { type: 'object', properties: { valueType: { enum: ['string'] } } },
          {
            type: 'object',
            not: { type: 'object', required: ['valueFormat'] },
          },
        ],
        properties: {
          path: {
            type: 'array',
            minItems: 1,
            maxItems: 10,
            description:
              // eslint-disable-next-line max-len
              'Claims path pointers (OpenID4VP 1.0, section 7), tried in order on each credential of the rule\'s `type`. The first pointer that selects anything supplies the values. A pointer is an array of segments: a string selects that key of an object, a non-negative integer selects that index of an array, and null selects every element of an array. Only string, number and boolean values are used. For example `[["credentialSubject", "email"], ["credentialSubject", "emails", null]]`',
            items: {
              type: 'array',
              minItems: 1,
              maxItems: 32,
              items: {
                anyOf: [
                  { type: 'string', minLength: 1, nullable: true },
                  { type: 'integer', minimum: 0 },
                ],
              },
            },
          },
          rule: {
            type: 'string',
            description:
              // eslint-disable-next-line max-len
              'how the rule uses the values its path finds. `pick` uses every value found. `equal` uses a value only when exactly one distinct value is found',
            enum: ['pick', 'equal'],
          },
          valueIndex: {
            type: 'integer',
            minimum: 0,
            maximum: 9,
            description:
              "the position of this rule's value in a depot's `authValues`. The rules' value indexes must be exactly 0 to n-1, each used once",
          },
          type: {
            type: 'string',
            minLength: 1,
            description:
              'the credential type that the rule reads. It must be one of the `disclosureRequest` types',
          },
          valueType: {
            type: 'string',
            enum: ['string', 'number', 'boolean'],
            description:
              // eslint-disable-next-line max-len
              "the JSON type of the rule's values. A depot's auth value at the rule's `valueIndex` must have this type. Values of another type that the rule reads from a credential are ignored, never converted",
          },
          valueFormat: {
            type: 'string',
            enum: ['email', 'e164'],
            description:
              // eslint-disable-next-line max-len
              "the format of a `string` rule's values, which depots/create checks after trimming the value: `email` is an email address, checked as AJV's `email` format, and `e164` is a phone number in E.164 format, such as `+15556192191`. It doesn't change how values are read or matched. Only allowed when `valueType` is `string`",
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
  anyOf: [
    {
      description: 'preauth only',
      properties: {
        authMethods: { type: 'array', items: { enum: ['preauth'] } },
      },
    },
    {
      description: 'internal verifiable_presentation, alone or with preauth',
      required: ['disclosureRequest', 'verifiablePresentationAuthRules'],
      properties: {
        authMode: { enum: ['internal'] },
        verifiablePresentationAuthRules: { type: 'array', minItems: 1 },
      },
      not: { required: ['presentationDefinition'] },
    },
  ],
};

module.exports = newIssuerServiceSchema;
