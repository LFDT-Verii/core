/*
 * Copyright 2026 Velocity Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

const { describe, it } = require('node:test');
const { expect } = require('expect');
const { times } = require('lodash/fp');
const {
  initOperatorApiValidator,
  operatorApiAjvFormats,
  operatorApiAjvOptions,
} = require('../src/validator');

const preauthService = (overrides) => ({
  velocityNetworkServiceId: 'did:ion:issuer#credential-issuer-1',
  termsUrl: 'https://example.com/terms',
  authMethods: ['preauth'],
  authMode: 'internal',
  ...overrides,
});

const vpService = (overrides) =>
  preauthService({
    authMethods: ['verifiable_presentation'],
    disclosureRequest: {
      types: [{ type: 'EmailV1.0' }],
      purpose: 'Identification',
      retentionPeriod: 'P30D',
    },
    verifiablePresentationAuthRules: [
      {
        path: [
          ['credentialSubject', 'email'],
          ['credentialSubject', 'emails', null],
          ['credentialSubject', 'emails', 0],
        ],
        rule: 'pick',
        valueIndex: 0,
        type: 'EmailV1.0',
      },
    ],
    ...overrides,
  });

const depot = (overrides) => ({
  userReference: 'employee-1',
  authValues: ['adam@example.com', 12345, true],
  ...overrides,
});

const credential = (overrides) => ({
  credentialReference: 'offer-1',
  content: {
    type: ['EmailV1.0'],
    credentialSubject: { email: 'adam@example.com' },
  },
  ...overrides,
});

const error = (keyword, instancePath) =>
  expect.objectContaining({ keyword, instancePath });

// AJV also reports the error of each anyOf or oneOf branch
const errorsWith = (keyword, instancePath) =>
  expect.arrayContaining([error(keyword, instancePath)]);

describe('operator API validator', () => {
  const { validate, assertValid } = initOperatorApiValidator();

  it('should use the AJV options the Hub uses', () => {
    expect(operatorApiAjvOptions).toEqual({
      removeAdditional: false,
      useDefaults: false,
      coerceTypes: false,
      allErrors: false,
      strictTypes: 'log',
    });
    expect(operatorApiAjvFormats).toEqual([
      'uri',
      'uri-reference',
      'iri',
      'iri-reference',
      'date',
      'date-time',
      'regex',
      'email',
      'duration',
    ]);
  });

  describe('new-issuer-service', () => {
    it('should accept a preauth service', () => {
      expect(validate('new-issuer-service', preauthService())).toEqual([]);
    });

    it('should accept a verifiable presentation service with auth rules', () => {
      expect(validate('new-issuer-service', vpService())).toEqual([]);
    });

    it('should refuse a service without a required property', () => {
      expect(
        validate('new-issuer-service', preauthService({ termsUrl: undefined })),
      ).toEqual([error('required', '')]);
    });

    it('should refuse an unknown property', () => {
      expect(
        validate('new-issuer-service', preauthService({ unknown: true })),
      ).toEqual([error('additionalProperties', '')]);
    });

    it('should refuse an unknown auth method or mode', () => {
      expect(
        validate(
          'new-issuer-service',
          preauthService({ authMethods: ['password'] }),
        ),
      ).toEqual([error('enum', '/authMethods/0')]);
      expect(
        validate(
          'new-issuer-service',
          preauthService({ authMode: 'external' }),
        ),
      ).toEqual([error('enum', '/authMode')]);
    });

    it('should check the formats', () => {
      expect(
        validate('new-issuer-service', preauthService({ termsUrl: 'terms' })),
      ).toEqual([error('format', '/termsUrl')]);
      expect(
        validate(
          'new-issuer-service',
          vpService({
            disclosureRequest: {
              types: [{ type: 'EmailV1.0' }],
              purpose: 'Identification',
              retentionPeriod: '30 days',
            },
          }),
        ),
      ).toEqual([error('format', '/disclosureRequest/retentionPeriod')]);
    });

    it('should refuse a claims path pointer with an empty key or a negative index', () => {
      const withPath = (path) =>
        vpService({
          verifiablePresentationAuthRules: [
            { path, rule: 'pick', valueIndex: 0, type: 'EmailV1.0' },
          ],
        });
      expect(
        validate('new-issuer-service', withPath([['credentialSubject', '']])),
      ).toEqual(
        errorsWith('anyOf', '/verifiablePresentationAuthRules/0/path/0/1'),
      );
      expect(
        validate('new-issuer-service', withPath([['credentialSubject', -1]])),
      ).toEqual(
        errorsWith('anyOf', '/verifiablePresentationAuthRules/0/path/0/1'),
      );
    });

    it('should neither apply defaults nor coerce types', () => {
      const service = preauthService();
      expect(validate('new-issuer-service', service)).toEqual([]);
      expect(service).toEqual(preauthService());
      expect(
        validate(
          'new-issuer-service',
          preauthService({ authTokensExpireIn: '600' }),
        ),
      ).toEqual([error('type', '/authTokensExpireIn')]);
    });
  });

  describe('new-depot', () => {
    it('should accept a depot', () => {
      expect(validate('new-depot', depot())).toEqual([]);
      expect(
        validate(
          'new-depot',
          depot({
            deferredCredentials: true,
            expectedCredentialTypes: ['EmailV1.0'],
          }),
        ),
      ).toEqual([]);
    });

    it('should refuse a depot without a userReference', () => {
      expect(
        validate('new-depot', depot({ userReference: undefined })),
      ).toEqual([error('required', '')]);
    });

    it('should refuse an auth value that is not a string, number or boolean', () => {
      expect(
        validate('new-depot', depot({ authValues: [{ email: 'a@x.com' }] })),
      ).toEqual(errorsWith('anyOf', '/authValues/0'));
      expect(validate('new-depot', depot({ authValues: [null] }))).toEqual(
        errorsWith('anyOf', '/authValues/0'),
      );
    });

    it('should refuse an unknown property', () => {
      expect(validate('new-depot', depot({ serviceId: 'service-1' }))).toEqual([
        error('additionalProperties', ''),
      ]);
    });

    it('should refuse empty or repeated expected credential types', () => {
      expect(
        validate('new-depot', depot({ expectedCredentialTypes: [] })),
      ).toEqual([error('minItems', '/expectedCredentialTypes')]);
      expect(
        validate(
          'new-depot',
          depot({ expectedCredentialTypes: ['EmailV1.0', 'EmailV1.0'] }),
        ),
      ).toEqual([error('uniqueItems', '/expectedCredentialTypes')]);
    });

    it('should neither apply defaults nor coerce types', () => {
      const newDepot = depot();
      expect(validate('new-depot', newDepot)).toEqual([]);
      expect(newDepot).toEqual(depot());
      expect(
        validate('new-depot', depot({ deferredCredentials: 'true' })),
      ).toEqual([error('type', '/deferredCredentials')]);
    });
  });

  describe('new-credential', () => {
    it('should accept a credential', () => {
      expect(validate('new-credential', credential())).toEqual([]);
      expect(
        validate('new-credential', credential({ tags: ['batch-1'] })),
      ).toEqual([]);
    });

    it('should refuse a credential without a credentialReference', () => {
      expect(
        validate(
          'new-credential',
          credential({ credentialReference: undefined }),
        ),
      ).toEqual([error('required', '')]);
    });

    it('should validate the content with the w3c-vc schema', () => {
      expect(
        validate('new-credential', credential({ content: { type: ['A'] } })),
      ).toEqual([error('required', '/content')]);
    });

    it('should validate related resources with the schema w3c-vc references', () => {
      expect(
        validate(
          'new-credential',
          credential({
            content: {
              type: ['EmailV1.0'],
              credentialSubject: {},
              relatedResource: [{ id: 'not a uri' }],
            },
          }),
        ),
      ).toEqual(errorsWith('oneOf', '/content/relatedResource/0'));
    });

    it('should refuse a tag that is not a string', () => {
      expect(validate('new-credential', credential({ tags: [1] }))).toEqual([
        error('type', '/tags/0'),
      ]);
    });
  });

  describe('find-depots-request', () => {
    const serviceId = '6af54a010df57797ab6c3ec9';
    const depotId = '6AF54A010DF57797AB6C3ECA';
    const authValues = [['adam@example.com', 12345, true]];
    const findDepots = (overrides) => ({ tenantId: 'tenant-1', ...overrides });
    const validateFindDepots = (overrides) =>
      validate('find-depots-request', findDepots(overrides));

    it('should accept the depots/get filters, with or without authValues', () => {
      expect(validateFindDepots()).toEqual([]);
      expect(validateFindDepots({ serviceId, depotId })).toEqual([]);
      expect(validateFindDepots({ depotId: [depotId, serviceId] })).toEqual([]);
      expect(validateFindDepots({ serviceId, authValues })).toEqual([]);
      expect(
        validateFindDepots({ serviceId, depotId: [depotId], authValues }),
      ).toEqual([]);
    });

    it('should refuse authValues without a serviceId', () => {
      expect(validateFindDepots({ authValues })).toEqual(
        errorsWith('anyOf', ''),
      );
      expect(validateFindDepots({ depotId, authValues })).toEqual(
        errorsWith('anyOf', ''),
      );
    });

    it('should refuse a serviceId or depotId that is not an ObjectId', () => {
      expect(validateFindDepots({ serviceId: 'service-1' })).toEqual([
        error('pattern', '/serviceId'),
      ]);
      expect(validateFindDepots({ depotId: 'depot-1' })).toEqual(
        errorsWith('pattern', '/depotId'),
      );
      expect(validateFindDepots({ depotId: [depotId, 'depot-1'] })).toEqual(
        errorsWith('pattern', '/depotId/1'),
      );
    });

    it('should refuse more than 1000 tuples, or more than 10 values in a tuple', () => {
      expect(
        validateFindDepots({
          serviceId,
          authValues: times(() => ['adam@example.com'], 1001),
        }),
      ).toEqual([error('maxItems', '/authValues')]);
      expect(
        validateFindDepots({
          serviceId,
          authValues: [times((i) => `value-${i}`, 11)],
        }),
      ).toEqual([error('maxItems', '/authValues/0')]);
    });

    it('should refuse no tuples, or an empty tuple', () => {
      expect(validateFindDepots({ serviceId, authValues: [] })).toEqual([
        error('minItems', '/authValues'),
      ]);
      expect(validateFindDepots({ serviceId, authValues: [[]] })).toEqual([
        error('minItems', '/authValues/0'),
      ]);
    });

    it('should refuse an auth value that is not a string, number or boolean', () => {
      expect(
        validateFindDepots({
          serviceId,
          authValues: [['adam@example.com', { id: 12345 }]],
        }),
      ).toEqual(errorsWith('anyOf', '/authValues/0/1'));
    });

    // The Hub checks the values against the service's auth rules
    it('should accept a blank value, or a tuple of any length up to 10', () => {
      expect(
        validateFindDepots({ serviceId, authValues: [['  ', ''], ['a']] }),
      ).toEqual([]);
    });

    it('should refuse an unknown property, or no tenantId', () => {
      expect(validateFindDepots({ userReference: 'employee-1' })).toEqual([
        error('additionalProperties', ''),
      ]);
      expect(validate('find-depots-request', { serviceId })).toEqual([
        error('required', ''),
      ]);
    });
  });

  it('should report only the first error, as the Hub does', () => {
    expect(
      validate('new-depot', { authValues: [{}], serviceId: 'service-1' }),
    ).toHaveLength(1);
  });

  it('should throw for an unknown schema', () => {
    expect(() => validate('depot', depot())).toThrow(
      'Unknown operator API schema "depot"',
    );
  });

  describe('assertValid', () => {
    it('should return valid data', () => {
      const newDepot = depot();
      expect(assertValid('new-depot', newDepot)).toBe(newDepot);
    });

    it('should throw the 400 error Fastify gives, prefixed with the schema id', () => {
      expect(() =>
        assertValid('new-depot', depot({ deferredCredentials: 'true' })),
      ).toThrow(
        expect.objectContaining({
          message: 'new-depot/deferredCredentials must be boolean',
          statusCode: 400,
          code: 'FST_ERR_VALIDATION',
          validation: [error('type', '/deferredCredentials')],
        }),
      );
    });

    it('should prefix the message with dataVar', () => {
      expect(() =>
        assertValid(
          'new-depot',
          depot({ deferredCredentials: 'true' }),
          'body/depot',
        ),
      ).toThrow('body/depot/deferredCredentials must be boolean');
    });
  });

  it('should build validators that are independent of each other', () => {
    const other = initOperatorApiValidator();
    expect(other.validate('new-depot', depot())).toEqual([]);
    expect(validate('new-depot', depot())).toEqual([]);
  });
});
