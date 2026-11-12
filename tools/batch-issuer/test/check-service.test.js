/**
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
 */

const { describe, it } = require('node:test');
const { expect } = require('expect');
const { checkService } = require('../src/validation/check-service');
const {
  SERVICE_ID,
  TENANT_ID,
  baseSpec,
  buildService,
  emailRule,
  phoneRule,
} = require('./helpers/fixtures');

const badgeTemplate = { template: './badge.json', type: 'OpenBadgeCredential' };

const check = ({
  spec = baseSpec,
  templates = [badgeTemplate],
  service = buildService(),
  now,
}) => checkService({ spec, templates, service, now });

describe('checkService', () => {
  it("maps depot.authValues to the service's rules", () => {
    expect(check({})).toEqual({
      authColumns: [{ column: 'email', rule: emailRule }],
      errors: [],
    });
  });

  it('orders the rules by valueIndex', () => {
    const service = buildService({
      verifiablePresentationAuthRules: [phoneRule, emailRule],
    });
    const spec = {
      ...baseSpec,
      depot: {
        ...baseSpec.depot,
        authValues: [{ column: 'email' }, { column: 'mobile' }],
      },
    };
    expect(check({ spec, service })).toEqual({
      authColumns: [
        { column: 'email', rule: emailRule },
        { column: 'mobile', rule: phoneRule },
      ],
      errors: [],
    });
  });

  it('reports a missing service', () => {
    expect(check({ service: null })).toEqual({
      errors: [
        { reason: `tenant ${TENANT_ID} has no issuer service ${SERVICE_ID}` },
      ],
    });
  });

  it('accepts a service with both auth methods', () => {
    const service = buildService({
      authMethods: ['preauth', 'verifiable_presentation'],
    });
    expect(check({ service }).errors).toEqual([]);
  });

  describe('a preauth service', () => {
    const service = buildService({
      authMethods: ['preauth'],
      authMode: undefined,
      disclosureRequest: undefined,
      verifiablePresentationAuthRules: undefined,
    });

    it('takes no auth values', () => {
      const spec = {
        ...baseSpec,
        depot: { ...baseSpec.depot, authValues: undefined },
      };
      expect(check({ spec, service })).toEqual({ authColumns: [], errors: [] });
    });

    it('reports auth values', () => {
      expect(check({ service })).toEqual({
        errors: [
          {
            reason:
              'depot.authValues has 1 entries, but the service has 0 auth rules',
          },
        ],
      });
    });
  });

  it('reports a service that is neither internal verifiable_presentation nor preauth', () => {
    const service = buildService({
      authMode: undefined,
      presentationDefinition: {},
    });
    expect(check({ service })).toEqual({
      errors: [
        {
          reason:
            'the service must use internal verifiable_presentation auth or preauth',
        },
      ],
    });
  });

  it('reports a verifiable_presentation service without rules', () => {
    const service = buildService({ verifiablePresentationAuthRules: [] });
    expect(check({ service })).toEqual({
      errors: [
        { reason: 'the service has no verifiablePresentationAuthRules' },
      ],
    });
  });

  it('reports a deactivated service', () => {
    const service = buildService({
      deactivationDate: '2026-11-01T00:00:00.000Z',
    });
    expect(
      check({ service, now: new Date('2026-11-12T00:00:00.000Z') }),
    ).toEqual({
      authColumns: [{ column: 'email', rule: emailRule }],
      errors: [
        { reason: 'the service was deactivated at 2026-11-01T00:00:00.000Z' },
      ],
    });
    expect(
      check({ service, now: new Date('2026-10-31T00:00:00.000Z') }).errors,
    ).toEqual([]);
  });

  it('reports a different number of auth values and rules', () => {
    const service = buildService({
      verifiablePresentationAuthRules: [emailRule, phoneRule],
    });
    expect(check({ service })).toEqual({
      errors: [
        {
          reason:
            'depot.authValues has 1 entries, but the service has 2 auth rules',
        },
      ],
    });
  });

  it('reports rules whose value indexes are not 0 to n-1', () => {
    const service = buildService({
      verifiablePresentationAuthRules: [
        emailRule,
        { ...phoneRule, valueIndex: 2 },
      ],
    });
    const spec = {
      ...baseSpec,
      depot: {
        ...baseSpec.depot,
        authValues: [{ column: 'email' }, { column: 'mobile' }],
      },
    };
    expect(check({ spec, service })).toEqual({
      errors: [
        {
          reason: "the service's auth rules must have the valueIndexes 0 to 1",
        },
      ],
    });
  });

  describe('template types', () => {
    const otherTemplate = { template: './other.json', type: 'EmailV1.0' };
    const typeError = {
      reason:
        'template ./other.json has the type EmailV1.0, which is not in depot.expectedCredentialTypes',
    };

    it("reports a template whose type isn't in depot.expectedCredentialTypes", () => {
      expect(
        check({ templates: [badgeTemplate, otherTemplate] }).errors,
      ).toEqual([typeError]);
    });

    it('reports it with the service errors', () => {
      expect(
        check({ templates: [otherTemplate], service: null }).errors,
      ).toEqual([
        { reason: `tenant ${TENANT_ID} has no issuer service ${SERVICE_ID}` },
        typeError,
      ]);
    });

    it('accepts any type when the depot expects no types', () => {
      const spec = {
        ...baseSpec,
        depot: { ...baseSpec.depot, expectedCredentialTypes: undefined },
      };
      expect(check({ spec, templates: [otherTemplate] }).errors).toEqual([]);
    });
  });
});
