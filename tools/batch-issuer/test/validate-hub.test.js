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
const { toUpper } = require('lodash/fp');
const nock = require('./helpers/nock');
const {
  depotsMatching,
  mockFindDepots,
  mockGetService,
  mockRegistrar,
  mockServices,
  useNock,
} = require('./helpers/mock-services');
const { HUB_ARGS, runCapture, validateJson } = require('./helpers/run-cli');
const {
  ADAM,
  BETH,
  DEPOT_ID,
  OPEN_BADGE_SCHEMA_URL,
  REGISTRAR_URL,
  SERVICE_ID,
  TEMPLATE,
  TENANT_ID,
  baseSpec,
  buildDepot,
  buildService,
  depotOnlySpec,
  emailRule,
  loadJsonFixture,
  phoneRule,
  useTempFiles,
} = require('./helpers/fixtures');

const noSuchService = `tenant ${TENANT_ID} has no issuer service ${SERVICE_ID}`;

const withDepot = (spec, depot) => ({
  ...spec,
  depot: { ...spec.depot, ...depot },
});

describe('batch-issuer validate: the batch against the Hub and the registrar', () => {
  useNock();
  const { writeBatch } = useTempFiles();

  describe('the spec against the service', () => {
    const preauthService = buildService({
      authMethods: ['preauth'],
      authMode: undefined,
      disclosureRequest: undefined,
      verifiablePresentationAuthRules: undefined,
    });
    const twoRules = [emailRule, phoneRule];
    const twoAuthValues = {
      authValues: [{ column: 'email' }, { column: 'mobile' }],
    };
    const serviceCases = [
      {
        name: 'a deactivated service',
        services: [
          buildService({ deactivationDate: '2020-01-01T00:00:00.000Z' }),
        ],
        errors: [
          { reason: 'the service was deactivated at 2020-01-01T00:00:00.000Z' },
        ],
      },
      {
        name: 'a service to be deactivated in the future',
        services: [
          buildService({ deactivationDate: '2999-01-01T00:00:00.000Z' }),
        ],
        errors: [],
      },
      {
        name: 'a service that is neither internal verifiable_presentation nor preauth',
        services: [
          buildService({ authMode: undefined, presentationDefinition: {} }),
        ],
        errors: [
          {
            reason:
              'the service must use internal verifiable_presentation auth or preauth',
          },
        ],
      },
      {
        name: 'a verifiable_presentation service without rules',
        services: [buildService({ verifiablePresentationAuthRules: [] })],
        errors: [
          { reason: 'the service has no verifiablePresentationAuthRules' },
        ],
      },
      {
        name: 'rules whose valueIndexes are not 0 to n-1',
        services: [
          buildService({
            verifiablePresentationAuthRules: [
              emailRule,
              { ...phoneRule, valueIndex: 2 },
            ],
          }),
        ],
        spec: withDepot(baseSpec, twoAuthValues),
        errors: [
          {
            reason:
              "the service's auth rules must have the valueIndexes 0 to 1",
          },
        ],
      },
      {
        name: 'more rules than depot.authValues',
        services: [buildService({ verifiablePresentationAuthRules: twoRules })],
        errors: [
          {
            reason:
              'depot.authValues has 1 entries, but the service has 2 auth rules',
          },
        ],
      },
      {
        name: 'a service with both auth methods',
        services: [
          buildService({ authMethods: ['preauth', 'verifiable_presentation'] }),
        ],
        errors: [],
      },
      {
        name: 'a preauth service, which takes no auth values',
        services: [preauthService],
        spec: withDepot(baseSpec, { authValues: undefined }),
        errors: [],
      },
      {
        name: 'a preauth service given auth values',
        services: [preauthService],
        errors: [
          {
            reason:
              'depot.authValues has 1 entries, but the service has 0 auth rules',
          },
        ],
      },
      {
        name: "a template whose type isn't in depot.expectedCredentialTypes",
        spec: withDepot(baseSpec, { expectedCredentialTypes: ['EmailV1.0'] }),
        errors: [
          {
            reason: `template ${TEMPLATE} has the type OpenBadgeCredential, which is not in depot.expectedCredentialTypes`,
          },
        ],
      },
      {
        name: 'a tenant without the service',
        services: [],
        errors: [{ reason: noSuchService }],
      },
      {
        name: 'a service list without the requested id',
        services: [buildService({ id: '6512a1b2c3d4e5f6a7b8c9ff' })],
        errors: [{ reason: noSuchService }],
      },
      {
        name: 'a serviceId in upper case',
        spec: { ...baseSpec, serviceId: toUpper(SERVICE_ID) },
        serviceId: toUpper(SERVICE_ID),
        errors: [],
      },
    ];

    for (const { name, services, spec, serviceId, errors } of serviceCases) {
      it(name, async () => {
        mockGetService(services, { serviceId });
        mockFindDepots();
        mockRegistrar();

        const { exitCode, report } = await validateJson(
          writeBatch({ spec, csvLines: [ADAM] }),
        );

        expect({ exitCode, errors: report.errors }).toEqual({
          exitCode: errors.length > 0 ? 1 : 0,
          errors,
        });
      });
    }

    it('does not look up depots for a preauth service', async () => {
      const requests = [];
      mockServices({
        services: [
          { ...buildService(), authMethods: ['preauth'], authMode: undefined },
        ],
        requests,
      });
      const spec = withDepot(baseSpec, { authValues: undefined });

      const { exitCode } = await validateJson(
        writeBatch({ spec, csvLines: [ADAM, BETH] }),
      );

      expect(exitCode).toEqual(0);
      expect(requests).toEqual([]);
    });
  });

  describe('credentials against their types', () => {
    it("checks each credentialSubject against its type's schema from the registrar", async () => {
      mockGetService();
      mockFindDepots();
      const schemaRequest = mockRegistrar();
      const badge = loadJsonFixture('open-badge.template.json');
      const achievement = {
        ...badge.credentialSubject.achievement,
        name: undefined,
      };
      const template = {
        ...badge,
        credentialSubject: {
          ...badge.credentialSubject,
          activityEndDate: '{{endDate}}',
          achievement,
        },
      };
      const csvText =
        'employeeId,email,firstName,lastName,creditsEarned,endDate\nE1,a@example.com,A,B,1,2026-11-01T00:00:00Z\nE2,b@example.com,C,D,2,soon\n';
      const batch = writeBatch({
        csvText,
        templates: { 'open-badge.template.json': template },
      });

      const { exitCode, report } = await validateJson(batch);

      const nameRequired =
        "credentialSubject/achievement must have required property 'name'";
      expect(exitCode).toEqual(1);
      expect(report.errors).toEqual([
        { row: 2, template: TEMPLATE, reason: nameRequired },
        {
          row: 3,
          template: TEMPLATE,
          reason:
            'credentialSubject/activityEndDate must match format "date-time"',
        },
        { row: 3, template: TEMPLATE, reason: nameRequired },
      ]);
      expect(schemaRequest.isDone()).toEqual(true);
    });

    it('checks two templates per row, and reports a type the registrar does not know', async () => {
      mockGetService();
      mockFindDepots();
      const metadataRequest = nock(REGISTRAR_URL)
        .get('/api/v0.6/credential-types')
        .query({
          credentialType: ['OpenBadgeCredential', 'CourseCompletionV1.0'],
        })
        .reply(200, [
          {
            credentialType: 'OpenBadgeCredential',
            schemaUrl: OPEN_BADGE_SCHEMA_URL,
          },
        ]);
      nock(REGISTRAR_URL)
        .get(new URL(OPEN_BADGE_SCHEMA_URL).pathname)
        .reply(200, loadJsonFixture('open-badge-credential.schema.json'));
      const spec = {
        ...withDepot(baseSpec, {
          expectedCredentialTypes: [
            'OpenBadgeCredential',
            'CourseCompletionV1.0',
          ],
        }),
        credentials: [
          ...baseSpec.credentials,
          {
            template: './course.json',
            credentialReference: '{{employeeId}}-course',
          },
        ],
      };
      const course = {
        type: ['CourseCompletionV1.0'],
        credentialSubject: { course: 'IVIE', learner: '{{firstName}}' },
      };
      const batch = writeBatch({
        spec,
        csvLines: [ADAM, BETH],
        templates: { 'course.json': course },
      });

      const { exitCode, report } = await validateJson(batch);

      expect(metadataRequest.isDone()).toEqual(true);
      expect({ exitCode, report }).toEqual({
        exitCode: 1,
        report: {
          valid: false,
          errors: [
            {
              reason:
                'the registrar has no credential type CourseCompletionV1.0',
            },
          ],
          summary: { rows: 2, newDepots: 2, existingDepots: 0, credentials: 4 },
        },
      });
    });

    it('needs --registrar for a spec with credentials', async () => {
      mockGetService();
      mockFindDepots();
      const batch = writeBatch({ csvLines: [ADAM] });

      const result = await runCapture([
        'validate',
        batch.specFile,
        batch.csvFile,
        ...HUB_ARGS,
      ]);

      expect(result).toEqual({
        exitCode: 2,
        stdout: '',
        stderr:
          'Error: the spec has credentials, so --registrar is required to check them\n',
      });
    });

    it('does not need the registrar for a depot-only spec', async () => {
      mockGetService();
      mockFindDepots();
      const batch = writeBatch({ spec: depotOnlySpec, csvLines: [ADAM, BETH] });

      const result = await runCapture([
        'validate',
        batch.specFile,
        batch.csvFile,
        ...HUB_ARGS,
      ]);

      expect(result).toEqual({
        exitCode: 0,
        stdout:
          'The batch is valid: 2 rows, 2 new depots, 0 existing depots, 0 credentials. Nothing was written to the Hub.\n',
        stderr: '',
      });
    });
  });

  describe('the batch against existing depots', () => {
    const reused = { rows: 2, newDepots: 1, existingDepots: 1 };
    const authValuesBelong = (reason) => ({
      row: 2,
      column: 'email',
      reason: `the auth values belong to ${reason}`,
    });
    const depotCases = [
      {
        name: "reuses a returning holder's depot, matching auth values as the Hub does",
        depots: [buildDepot({ authValues: [' Adam.Smith@Example.com'] })],
        summary: { ...reused, credentials: 2 },
      },
      {
        name: "reports a depot whose userReference isn't the row's",
        depots: [buildDepot({ userReference: 'E9999' })],
        errors: [
          authValuesBelong(`depot ${DEPOT_ID}, whose userReference is "E9999"`),
        ],
      },
      {
        name: "reports a returning holder's depot with --no-reuse",
        depots: [buildDepot()],
        args: ['--no-reuse'],
        errors: [authValuesBelong(`depot ${DEPOT_ID}, and --no-reuse is set`)],
      },
      {
        name: "reports a depot that doesn't expect the row's credential types",
        depots: [
          buildDepot({ expectedCredentialTypes: ['EmailV1.0', 'PhoneV1.0'] }),
        ],
        errors: [
          authValuesBelong(
            `depot ${DEPOT_ID}, which doesn't expect credentials of type OpenBadgeCredential`,
          ),
        ],
      },
      {
        name: "reuses a depot that expects the row's credential types",
        depots: [
          buildDepot({ expectedCredentialTypes: ['OpenBadgeCredential'] }),
        ],
        summary: { ...reused, credentials: 2 },
      },
      {
        name: "reuses a depot that doesn't defer credentials when the load adds credentials",
        depots: [buildDepot({ deferredCredentials: false })],
        summary: { ...reused, credentials: 2 },
      },
      {
        name: 'reports auth values that belong to more than one depot',
        depots: [buildDepot(), buildDepot({ id: '6512a1b2c3d4e5f6a7b8c9e1' })],
        errors: [
          authValuesBelong(`2 depots: ${DEPOT_ID}, 6512a1b2c3d4e5f6a7b8c9e1`),
        ],
      },
      {
        name: "in a depot-only load, reports a depot that doesn't expect the spec's credential types",
        spec: depotOnlySpec,
        depots: [
          buildDepot({
            deferredCredentials: true,
            expectedCredentialTypes: ['EmailV1.0'],
          }),
        ],
        errors: [
          authValuesBelong(
            `depot ${DEPOT_ID}, which doesn't expect credentials of type OpenBadgeCredential`,
          ),
        ],
      },
      {
        name: "in a depot-only load, reuses a depot that expects the spec's credential types",
        spec: depotOnlySpec,
        depots: [
          buildDepot({
            deferredCredentials: true,
            expectedCredentialTypes: ['EmailV1.0', 'OpenBadgeCredential'],
          }),
        ],
        summary: { ...reused, credentials: 0 },
      },
      {
        name: 'in a depot-only load without expectedCredentialTypes, reuses a depot whatever it expects',
        spec: withDepot(depotOnlySpec, { expectedCredentialTypes: undefined }),
        depots: [
          buildDepot({
            deferredCredentials: true,
            expectedCredentialTypes: ['EmailV1.0'],
          }),
        ],
        summary: { ...reused, credentials: 0 },
      },
      {
        name: "in a depot-only load, reports a depot that doesn't defer credentials",
        spec: depotOnlySpec,
        depots: [buildDepot({ deferredCredentials: false })],
        errors: [
          authValuesBelong(
            `depot ${DEPOT_ID}, which doesn't defer credentials, so a depot-only load can't reuse it`,
          ),
        ],
      },
      {
        name: 'in a depot-only load, reports a depot without deferredCredentials',
        spec: depotOnlySpec,
        depots: [{ ...buildDepot(), deferredCredentials: undefined }],
        errors: [
          authValuesBelong(
            `depot ${DEPOT_ID}, which doesn't defer credentials, so a depot-only load can't reuse it`,
          ),
        ],
      },
    ];

    for (const {
      name,
      spec = baseSpec,
      depots,
      args = [],
      errors = [],
      summary,
    } of depotCases) {
      it(name, async () => {
        mockGetService();
        mockFindDepots(depotsMatching(depots));
        mockRegistrar();

        const { exitCode, report } = await validateJson(
          writeBatch({ spec, csvLines: [ADAM, BETH] }),
          ...args,
        );

        expect({ exitCode, errors: report.errors }).toEqual({
          exitCode: errors.length > 0 ? 1 : 0,
          errors,
        });
        if (summary != null) {
          expect(report.summary).toEqual(summary);
        }
      });
    }

    it('matches by type, so a string never matches a number', async () => {
      const requests = [];
      const idRule = {
        ...emailRule,
        type: 'EmployeeIdV1.0',
        valueType: 'number',
      };
      mockGetService([
        buildService({ verifiablePresentationAuthRules: [idRule] }),
      ]);
      mockFindDepots(
        depotsMatching([
          buildDepot({ userReference: 'other', authValues: ['1001'] }),
        ]),
        requests,
      );
      const spec = withDepot(depotOnlySpec, {
        userReference: 'E{{id}}',
        authValues: [{ column: 'id' }],
      });

      const { exitCode } = await validateJson(
        writeBatch({ spec, csvText: 'id\n1001\n' }),
      );

      expect(exitCode).toEqual(0);
      expect(requests[0].authValues).toEqual([[1001]]);
    });

    it('looks up only rows with valid auth values, each tuple once', async () => {
      const requests = [];
      mockGetService();
      mockFindDepots(() => [], requests);
      const csvLines = [
        ADAM,
        'E1002,adam,B,C,1',
        'E1003,ADAM.smith@example.com,D,E,1',
      ];

      await validateJson(writeBatch({ spec: depotOnlySpec, csvLines }));

      expect(requests).toEqual([
        {
          tenantId: TENANT_ID,
          serviceId: SERVICE_ID,
          authValues: [['adam.smith@example.com']],
        },
      ]);
    });

    it('sends at most 1000 auth values tuples per request', async () => {
      const requests = [];
      mockGetService();
      const returning = buildDepot({
        userReference: 'E2400',
        authValues: ['holder-2400@example.com'],
        deferredCredentials: true,
      });
      mockFindDepots(depotsMatching([returning]), requests);
      const csvLines = Array.from(
        { length: 2500 },
        (value, index) => `E${index},holder-${index}@example.com`,
      );
      const batch = writeBatch({
        spec: depotOnlySpec,
        csvText: `employeeId,email\n${csvLines.join('\n')}\n`,
      });

      const { exitCode, report } = await validateJson(batch);

      expect(exitCode).toEqual(0);
      expect(requests.map(({ authValues }) => authValues.length)).toEqual([
        1000, 1000, 500,
      ]);
      expect(requests[2].authValues[0]).toEqual(['holder-2000@example.com']);
      expect(report.summary).toEqual({
        rows: 2500,
        newDepots: 2499,
        existingDepots: 1,
        credentials: 0,
      });
    });
  });
});
