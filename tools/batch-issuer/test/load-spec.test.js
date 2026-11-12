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
const { loadSpec, readSpec } = require('../src/spec/load-spec');
const {
  SERVICE_ID,
  TENANT_ID,
  baseSpec,
  fixturePath,
  loadJsonFixture,
  writeBatch,
} = require('./helpers/fixtures');

const loadWith = (spec, templates) =>
  loadSpec(writeBatch({ spec, csvLines: [], templates }).specFile);

describe('loadSpec', () => {
  it('loads the fixture spec and its template', async () => {
    const { spec, templates, errors } = await loadSpec(
      fixturePath('spec.yaml'),
    );
    expect(errors).toEqual([]);
    expect(spec).toEqual({
      tenantId: TENANT_ID,
      serviceId: SERVICE_ID,
      depot: {
        userReference: '{{employeeId}}',
        authValues: [{ column: 'email' }],
        expectedCredentialTypes: ['OpenBadgeCredential'],
        deferredCredentials: false,
      },
      columns: { creditsEarned: 'number' },
      credentials: [
        {
          template: './open-badge.template.json',
          credentialReference: '{{employeeId}}-ivie-2026',
          tags: ['batch-2026-11'],
        },
      ],
    });
    expect(templates).toEqual([
      {
        template: './open-badge.template.json',
        credentialReference: '{{employeeId}}-ivie-2026',
        tags: ['batch-2026-11'],
        content: loadJsonFixture('open-badge.template.json'),
        type: 'OpenBadgeCredential',
      },
    ]);
  });

  it('resolves templates relative to the spec', async () => {
    const spec = {
      ...baseSpec,
      credentials: [
        { template: './badge.json', credentialReference: '{{employeeId}}' },
      ],
    };
    const badge = {
      type: ['BadgeV1.0'],
      credentialSubject: { name: '{{firstName}}' },
    };
    const { templates, errors } = await loadWith(spec, { 'badge.json': badge });
    expect(errors).toEqual([]);
    expect(templates).toEqual([
      expect.objectContaining({
        template: './badge.json',
        content: badge,
        type: 'BadgeV1.0',
      }),
    ]);
  });

  describe('the spec schema', () => {
    it('reports YAML that does not parse', async () => {
      const { errors } = await loadWith('tenantId: [unclosed');
      expect(errors).toEqual([
        { reason: expect.stringContaining('the spec is not valid YAML') },
      ]);
    });

    it('reports a spec that is not an object', async () => {
      expect((await loadWith('')).errors).toEqual([
        { reason: 'spec must be object' },
      ]);
    });

    it('reports every schema error, with its path', async () => {
      const spec = {
        serviceId: '',
        depot: { authValues: [{ col: 'email' }], deferredCredentials: 'no' },
        columns: { year: 'date' },
        credentials: [],
        extra: true,
      };
      const { errors } = await loadWith(spec);
      expect(errors).toEqual([
        { reason: "spec must have required property 'tenantId'" },
        { reason: 'spec must NOT have additional properties: extra' },
        { reason: 'spec.serviceId must NOT have fewer than 1 characters' },
        { reason: "spec.depot must have required property 'userReference'" },
        {
          reason:
            "spec.depot.authValues.0 must have required property 'column'",
        },
        {
          reason:
            'spec.depot.authValues.0 must NOT have additional properties: col',
        },
        { reason: 'spec.depot.deferredCredentials must be boolean' },
        {
          reason:
            'spec.columns.year must be equal to one of the allowed values: string, number, boolean',
        },
        { reason: 'spec.credentials must NOT have fewer than 1 items' },
      ]);
    });

    it('reports a credential without a template or credentialReference', async () => {
      const spec = { ...baseSpec, credentials: [{ tags: [1] }] };
      const { errors } = await loadWith(spec);
      expect(errors).toEqual([
        { reason: "spec.credentials.0 must have required property 'template'" },
        {
          reason:
            "spec.credentials.0 must have required property 'credentialReference'",
        },
        { reason: 'spec.credentials.0.tags.0 must be string' },
      ]);
    });
  });

  describe('a depot-only spec', () => {
    const depotOnlySpec = (deferredCredentials) => ({
      tenantId: TENANT_ID,
      serviceId: SERVICE_ID,
      depot: { ...baseSpec.depot, deferredCredentials },
    });

    it('is valid when it defers credentials', async () => {
      const { spec, templates, errors } = await loadWith(depotOnlySpec(true));
      expect(errors).toEqual([]);
      expect(spec.credentials).toBeUndefined();
      expect(templates).toEqual([]);
    });

    it('needs depot.deferredCredentials: true', async () => {
      const expected = {
        reason:
          'a spec without credentials loads depots only, so it needs depot.deferredCredentials: true',
      };
      expect((await loadWith(depotOnlySpec(false))).errors).toEqual([expected]);
      expect((await loadWith(depotOnlySpec(undefined))).errors).toEqual([
        expected,
      ]);
    });
  });

  describe('templates', () => {
    const withTemplate = (template = './badge.json') => ({
      ...baseSpec,
      credentials: [{ template, credentialReference: '{{employeeId}}' }],
    });

    it('reports a template that cannot be read', async () => {
      const { errors } = await loadWith(withTemplate('./missing.json'));
      expect(errors).toEqual([
        {
          reason: expect.stringMatching(
            /^template \.\/missing\.json can't be read: ENOENT/,
          ),
        },
      ]);
    });

    it('reports a template that is not valid JSON', async () => {
      const { errors } = await loadWith(withTemplate(), {
        'badge.json': '{ "type": ',
      });
      expect(errors).toEqual([
        {
          reason: expect.stringMatching(
            /^template \.\/badge\.json is not valid JSON: /,
          ),
        },
      ]);
    });

    it('reports a template that is not a JSON object', async () => {
      const { errors } = await loadWith(withTemplate(), {
        'badge.json': '["BadgeV1.0"]',
      });
      expect(errors).toEqual([
        { reason: 'template ./badge.json is not a JSON object' },
      ]);
    });

    it('reports a template without a credential type', async () => {
      const badge = { type: ['VerifiableCredential'], credentialSubject: {} };
      const { errors } = await loadWith(withTemplate(), {
        'badge.json': badge,
      });
      expect(errors).toEqual([
        { reason: 'template ./badge.json has no credential type' },
      ]);
    });

    it('reports a template whose type is a Handlebars template', async () => {
      const badge = { type: ['{{type}}'], credentialSubject: {} };
      const { errors } = await loadWith(withTemplate(), {
        'badge.json': badge,
      });
      expect(errors).toEqual([
        {
          reason:
            "template ./badge.json's type must not be a Handlebars template",
        },
      ]);
    });

    it('reports Handlebars syntax errors in templates and the spec', async () => {
      const spec = {
        ...baseSpec,
        depot: { ...baseSpec.depot, userReference: '{{employeeId' },
        credentials: [
          {
            template: './badge.json',
            credentialReference: '{{id}}',
            tags: ['{{#if x}}'],
          },
        ],
      };
      const badge = {
        type: ['BadgeV1.0'],
        credentialSubject: { name: '{{name}' },
      };
      const { errors } = await loadWith(spec, { 'badge.json': badge });
      expect(errors).toEqual([
        {
          reason: expect.stringMatching(
            /^the spec has a template error: Parse error on line 1:\n\{\{employeeId/,
          ),
        },
        {
          reason: expect.stringMatching(
            /^the spec has a template error: Parse error on line 1:\n\{\{#if x\}\}/,
          ),
        },
        {
          reason: expect.stringMatching(
            /^template \.\/badge\.json has a template error: Parse error/,
          ),
        },
      ]);
    });
  });

  it('throws when the spec file cannot be read', async () => {
    await expect(loadSpec('/does/not/exist.yaml')).rejects.toThrow('ENOENT');
  });
});

describe('readSpec', () => {
  it('reads and checks the spec without loading templates', async () => {
    const spec = {
      ...baseSpec,
      credentials: [{ template: './missing.json', credentialReference: 'x' }],
    };
    const { specFile } = writeBatch({ spec, csvLines: [] });
    expect(await readSpec(specFile)).toEqual({ spec, errors: [] });
  });
});
