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

const {
  afterEach,
  before,
  after,
  beforeEach,
  describe,
  it,
} = require('node:test');
const { expect } = require('expect');
const nock = require('./helpers/nock');
const { runCapture } = require('./helpers/run-cli');
const {
  mockFindDepots,
  mockGetService,
  mockRegistrar,
} = require('./helpers/mock-services');
const {
  AUTH_TOKEN,
  HUB_URL,
  REGISTRAR_URL,
  SERVICE_ID,
  TENANT_ID,
  baseSpec,
  buildDepot,
  buildService,
  emailRule,
  fixturePath,
  loadJsonFixture,
  phoneRule,
  writeBatch,
} = require('./helpers/fixtures');

const hubArgs = ['--endpoint', HUB_URL, '--auth-token', AUTH_TOKEN];
const registrarArgs = ['--registrar', REGISTRAR_URL];

const validate = ({ specFile, csvFile }, ...args) =>
  runCapture([
    'validate',
    specFile,
    csvFile,
    ...hubArgs,
    ...registrarArgs,
    ...args,
  ]);

const validateJson = async (files, ...args) => {
  const result = await validate(files, '--json', ...args);
  return { ...result, report: JSON.parse(result.stdout) };
};

const fixtureFiles = {
  specFile: fixturePath('spec.yaml'),
  csvFile: fixturePath('holders.csv'),
};

const ADAM = 'E1001,adam.smith@example.com,Adam,Smith,1.5';
const BETH = 'E1002,beth.jones@example.com,Beth,Jones,2';

const depotOnlySpec = {
  tenantId: TENANT_ID,
  serviceId: SERVICE_ID,
  depot: { ...baseSpec.depot, deferredCredentials: true },
};

// Replies with the depots whose normalized auth values are among the tuples.
const depotsMatching = (depots) => (tuples) => {
  const keys = new Set(
    tuples.map((tuple) =>
      JSON.stringify(tuple.map((value) => value.trim().toLowerCase())),
    ),
  );
  return depots.filter(({ authValues }) =>
    keys.has(
      JSON.stringify(authValues.map((value) => value.trim().toLowerCase())),
    ),
  );
};

describe('batch-issuer validate', () => {
  before(() => {
    nock.disableNetConnect();
  });

  beforeEach(() => {
    nock.cleanAll();
  });

  afterEach(() => {
    delete process.env.BATCH_ISSUER_AUTH_TOKEN;
  });

  after(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  it('validates the fixture batch and exits with 0', async () => {
    const requests = [];
    const serviceRequest = mockGetService();
    mockFindDepots(() => [], requests);
    const schemaRequest = mockRegistrar();

    const result = await validate(fixtureFiles);

    expect(result).toEqual({
      exitCode: 0,
      stdout:
        'The batch is valid: 3 rows, 3 new depots, 0 existing depots, 3 credentials. Nothing was written to the Hub.\n',
      stderr: '',
    });
    expect(requests).toEqual([
      {
        tenantId: TENANT_ID,
        serviceId: SERVICE_ID,
        authValues: [
          ['adam.smith@example.com'],
          ['Beth.Jones@Example.com'],
          ['carl.ng@example.com'],
        ],
      },
    ]);
    expect(serviceRequest.isDone()).toEqual(true);
    expect(schemaRequest.isDone()).toEqual(true);
  });

  it('prints a JSON report with --json', async () => {
    mockGetService();
    mockFindDepots();
    mockRegistrar();

    const { exitCode, report } = await validateJson(fixtureFiles);

    expect(exitCode).toEqual(0);
    expect(report).toEqual({
      valid: true,
      errors: [],
      summary: { rows: 3, newDepots: 3, existingDepots: 0, credentials: 3 },
    });
  });

  it('reports every error, grouped by row, and exits with 1', async () => {
    mockGetService();
    mockFindDepots();
    mockRegistrar();
    const files = writeBatch({
      csvLines: [
        ADAM,
        'E1002,adam,Beth,Jones,two',
        'E1003, ADAM.SMITH@example.com ,Carl,Ng,0.5',
        'E1004,dee@example.com,Dee',
      ],
    });

    const result = await validate(files);

    expect(result.exitCode).toEqual(1);
    expect(result.stderr).toEqual('');
    expect(result.stdout).toEqual(
      [
        'Row 2:',
        '  - email: has the same auth values as row 4',
        '',
        'Row 3:',
        '  - email: "adam" is not an email address',
        '  - creditsEarned: "two" is not a number (template ./open-badge.template.json)',
        '',
        'Row 4:',
        '  - email: has the same auth values as row 2',
        '',
        'Row 5:',
        '  - creditsEarned: is missing (template ./open-badge.template.json)',
        '  - lastName: is missing (template ./open-badge.template.json)',
        '',
        'The batch is not valid: 6 errors. Nothing was written to the Hub.',
        '',
      ].join('\n'),
    );
  });

  it('reports spec errors without reading the CSV or calling the Hub', async () => {
    const files = writeBatch({ spec: { ...baseSpec, tenantId: undefined } });

    const { exitCode, report } = await validateJson({
      ...files,
      csvFile: '/does/not/exist.csv',
    });

    expect(exitCode).toEqual(1);
    expect(report).toEqual({
      valid: false,
      errors: [{ reason: "spec must have required property 'tenantId'" }],
    });
  });

  it('refuses a CSV with a quote that is never closed, without calling the Hub', async () => {
    const spec = {
      ...depotOnlySpec,
      depot: { ...depotOnlySpec.depot, userReference: '{{id}}' },
    };
    const files = writeBatch({
      spec,
      csvText: 'id,email,name\nE1,a@example.com,"Adam\nE2,b@example.com,Beth\n',
    });

    const { exitCode, report } = await validateJson(files);

    expect(exitCode).toEqual(1);
    expect(report).toEqual({
      valid: false,
      errors: [{ row: 2, reason: 'opens a quoted cell that is never closed' }],
    });
  });

  it('reports a spec that does not fit the service', async () => {
    mockGetService([
      buildService({ verifiablePresentationAuthRules: [emailRule, phoneRule] }),
    ]);
    mockRegistrar();
    const files = writeBatch({ csvLines: [ADAM] });

    const { exitCode, report } = await validateJson(files);

    expect(exitCode).toEqual(1);
    expect(report.errors).toEqual([
      {
        reason:
          'depot.authValues has 1 entries, but the service has 2 auth rules',
      },
    ]);
  });

  it('reports a missing service', async () => {
    mockGetService([]);
    mockRegistrar();
    const files = writeBatch({ csvLines: [ADAM] });

    const { exitCode, report } = await validateJson(files);

    expect(exitCode).toEqual(1);
    expect(report.errors).toEqual([
      { reason: `tenant ${TENANT_ID} has no issuer service ${SERVICE_ID}` },
    ]);
  });

  describe('--var', () => {
    it('overrides CSV values of the same name', async () => {
      mockGetService();
      mockFindDepots();
      mockRegistrar();
      const files = writeBatch({
        csvLines: ['E1001,adam@example.com,Adam,Smith,not-a-number'],
      });

      const result = await validate(
        files,
        '--var',
        'creditsEarned=3',
        '--var',
        'unused=a=b',
      );

      expect(result.exitCode).toEqual(0);
    });

    it('is a usage error without a name', async () => {
      const result = await validate(fixtureFiles, '--var', '=3');

      expect(result.exitCode).toEqual(2);
      expect(result.stderr).toContain(
        "option '--var <name=value>' argument '=3' is invalid. Use name=value.",
      );
    });
  });

  describe('phone numbers', () => {
    const phoneService = buildService({
      verifiablePresentationAuthRules: [{ ...phoneRule, valueIndex: 0 }],
    });
    const phoneSpec = {
      ...depotOnlySpec,
      depot: { ...depotOnlySpec.depot, authValues: [{ column: 'mobile' }] },
    };

    it('normalizes them with --default-country before looking them up', async () => {
      const requests = [];
      mockGetService([phoneService]);
      mockFindDepots(() => [], requests);
      const files = writeBatch({
        spec: phoneSpec,
        csvText: 'employeeId,mobile\nE1,(555) 619-2191\nE2,+61 412 345 678\n',
      });

      const result = await validate(files, '--default-country', 'us');

      expect(result.exitCode).toEqual(0);
      expect(requests[0].authValues).toEqual([
        ['+15556192191'],
        ['+61412345678'],
      ]);
    });

    it('reports numbers that cannot be normalized', async () => {
      mockGetService([phoneService]);
      mockFindDepots();
      const files = writeBatch({
        spec: phoneSpec,
        csvText: 'employeeId,mobile\nE1,5556192191\n',
      });

      const { exitCode, report } = await validateJson(files);

      expect(exitCode).toEqual(1);
      expect(report.errors).toEqual([
        {
          row: 2,
          column: 'mobile',
          reason:
            '"5556192191" is not a phone number. It has no country code, so pass --default-country',
        },
      ]);
    });

    it('refuses an unknown --default-country', async () => {
      const result = await validate(fixtureFiles, '--default-country', 'XX');

      expect(result.exitCode).toEqual(2);
      expect(result.stderr).toContain(
        'Use a two-letter country code, such as US.',
      );
    });
  });

  describe('credentials against their types (step 3)', () => {
    it("checks each credentialSubject against its type's schema from the registrar", async () => {
      mockGetService();
      mockFindDepots();
      const registrar = mockRegistrar();
      const badge = loadJsonFixture('open-badge.template.json');
      const template = {
        ...badge,
        credentialSubject: {
          ...badge.credentialSubject,
          activityEndDate: '{{endDate}}',
          achievement: {
            ...badge.credentialSubject.achievement,
            name: undefined,
          },
        },
      };
      const files = writeBatch({
        csvText:
          'employeeId,email,firstName,lastName,creditsEarned,endDate\nE1,a@example.com,A,B,1,2026-11-01T00:00:00Z\nE2,b@example.com,C,D,2,soon\n',
        templates: { 'open-badge.template.json': template },
      });

      const { exitCode, report } = await validateJson(files);

      expect(exitCode).toEqual(1);
      expect(report.errors).toEqual([
        {
          row: 2,
          template: './open-badge.template.json',
          reason:
            "credentialSubject/achievement must have required property 'name'",
        },
        {
          row: 3,
          template: './open-badge.template.json',
          reason:
            'credentialSubject/activityEndDate must match format "date-time"',
        },
        {
          row: 3,
          template: './open-badge.template.json',
          reason:
            "credentialSubject/achievement must have required property 'name'",
        },
      ]);
      expect(registrar.isDone()).toEqual(true);
    });

    it('asks the registrar for the credential type of each template', async () => {
      mockGetService();
      mockFindDepots();
      const metadataRequest = nock(REGISTRAR_URL)
        .get('/api/v0.6/credential-types')
        .query({ credentialType: 'OpenBadgeCredential' })
        .reply(200, []);
      const files = writeBatch({ csvLines: [ADAM] });

      const { exitCode, report } = await validateJson(files);

      expect(metadataRequest.isDone()).toEqual(true);
      expect(exitCode).toEqual(1);
      expect(report.errors).toEqual([
        { reason: 'the registrar has no credential type OpenBadgeCredential' },
      ]);
    });

    it('needs --registrar for a spec with credentials', async () => {
      mockGetService();
      const files = writeBatch({ csvLines: [ADAM] });

      const result = await runCapture([
        'validate',
        files.specFile,
        files.csvFile,
        ...hubArgs,
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
      const files = writeBatch({ spec: depotOnlySpec, csvLines: [ADAM, BETH] });

      const result = await runCapture([
        'validate',
        files.specFile,
        files.csvFile,
        ...hubArgs,
      ]);

      expect(result).toEqual({
        exitCode: 0,
        stdout:
          'The batch is valid: 2 rows, 2 new depots, 0 existing depots, 0 credentials. Nothing was written to the Hub.\n',
        stderr: '',
      });
    });
  });

  describe('the batch against the Hub (step 4)', () => {
    const files = () => writeBatch({ csvLines: [ADAM, BETH] });

    it("reuses a returning holder's depot", async () => {
      mockGetService();
      const depot = buildDepot({ authValues: [' Adam.Smith@Example.com'] });
      mockFindDepots(depotsMatching([depot]));
      mockRegistrar();

      const result = await validate(files());

      expect(result.exitCode).toEqual(0);
      expect(result.stdout).toEqual(
        'The batch is valid: 2 rows, 1 new depot, 1 existing depot, 2 credentials. Nothing was written to the Hub.\n',
      );
    });

    it("reports a depot whose userReference is not the row's", async () => {
      mockGetService();
      mockFindDepots(() => [buildDepot({ userReference: 'E9999' })]);
      mockRegistrar();

      const { exitCode, report } = await validateJson(files());

      expect(exitCode).toEqual(1);
      expect(report.errors).toEqual([
        {
          row: 2,
          column: 'email',
          reason:
            'the auth values belong to depot 6512a1b2c3d4e5f6a7b8c9e0, whose userReference is "E9999"',
        },
      ]);
    });

    it("reports a returning holder's depot with --no-reuse", async () => {
      mockGetService();
      mockFindDepots(() => [buildDepot()]);
      mockRegistrar();

      const { exitCode, report } = await validateJson(files(), '--no-reuse');

      expect(exitCode).toEqual(1);
      expect(report.errors).toEqual([
        {
          row: 2,
          column: 'email',
          reason:
            'the auth values belong to depot 6512a1b2c3d4e5f6a7b8c9e0, and --no-reuse is set',
        },
      ]);
    });

    it("reports a returning holder's depot that does not expect the credentials", async () => {
      mockGetService();
      mockFindDepots(() => [
        buildDepot({ expectedCredentialTypes: ['EmailV1.0', 'PhoneV1.0'] }),
      ]);
      mockRegistrar();

      const { exitCode, report } = await validateJson(files());

      expect(exitCode).toEqual(1);
      expect(report.errors).toEqual([
        {
          row: 2,
          column: 'email',
          reason:
            "the auth values belong to depot 6512a1b2c3d4e5f6a7b8c9e0, which doesn't expect credentials of type OpenBadgeCredential",
        },
      ]);
    });

    it("accepts a returning holder's depot that expects the credentials", async () => {
      mockGetService();
      mockFindDepots(() => [
        buildDepot({ expectedCredentialTypes: ['OpenBadgeCredential'] }),
      ]);
      mockRegistrar();

      const { exitCode, report } = await validateJson(files());

      expect(exitCode).toEqual(0);
      expect(report.summary).toEqual({
        rows: 2,
        newDepots: 1,
        existingDepots: 1,
        credentials: 2,
      });
    });

    describe('in a depot-only load', () => {
      const depotOnlyFiles = () =>
        writeBatch({ spec: depotOnlySpec, csvLines: [ADAM, BETH] });

      it("reports a returning holder's depot that doesn't defer credentials", async () => {
        mockGetService();
        mockFindDepots(() => [buildDepot({ deferredCredentials: false })]);

        const { exitCode, report } = await validateJson(depotOnlyFiles());

        expect(exitCode).toEqual(1);
        expect(report.errors).toEqual([
          {
            row: 2,
            column: 'email',
            reason:
              "the auth values belong to depot 6512a1b2c3d4e5f6a7b8c9e0, which doesn't defer credentials, so a depot-only load can't reuse it",
          },
        ]);
      });

      it("reports a returning holder's depot without deferredCredentials", async () => {
        const { deferredCredentials, ...depot } = buildDepot();
        mockGetService();
        mockFindDepots(() => [depot]);

        const { exitCode } = await validateJson(depotOnlyFiles());

        expect(deferredCredentials).toEqual(false);
        expect(exitCode).toEqual(1);
      });

      it("reuses a returning holder's depot that defers credentials", async () => {
        mockGetService();
        mockFindDepots(() => [buildDepot({ deferredCredentials: true })]);

        const { exitCode, report } = await validateJson(depotOnlyFiles());

        expect(exitCode).toEqual(0);
        expect(report.summary).toEqual({
          rows: 2,
          newDepots: 1,
          existingDepots: 1,
          credentials: 0,
        });
      });
    });

    it("does not need a returning holder's depot to defer credentials when the load adds credentials", async () => {
      mockGetService();
      mockFindDepots(() => [buildDepot({ deferredCredentials: false })]);
      mockRegistrar();

      const { exitCode } = await validateJson(files());

      expect(exitCode).toEqual(0);
    });

    it('reports auth values that belong to more than one depot', async () => {
      mockGetService();
      mockFindDepots(() => [
        buildDepot(),
        buildDepot({ id: '6512a1b2c3d4e5f6a7b8c9e1' }),
      ]);
      mockRegistrar();

      const { report } = await validateJson(files());

      expect(report.errors).toEqual([
        {
          row: 2,
          column: 'email',
          reason:
            'the auth values belong to 2 depots: 6512a1b2c3d4e5f6a7b8c9e0, 6512a1b2c3d4e5f6a7b8c9e1',
        },
      ]);
    });

    it('matches by type, so a string never matches a number', async () => {
      const idRule = {
        ...emailRule,
        type: 'EmployeeIdV1.0',
        valueType: 'number',
      };
      mockGetService([
        buildService({ verifiablePresentationAuthRules: [idRule] }),
      ]);
      const requests = [];
      mockFindDepots(
        () => [buildDepot({ userReference: 'other', authValues: ['1001'] })],
        requests,
      );
      const spec = {
        ...depotOnlySpec,
        depot: {
          ...depotOnlySpec.depot,
          userReference: 'E{{id}}',
          authValues: [{ column: 'id' }],
        },
      };
      const batch = writeBatch({ spec, csvText: 'id\n1001\n' });

      const { exitCode } = await validateJson(batch);

      expect(exitCode).toEqual(0);
      expect(requests[0].authValues).toEqual([[1001]]);
    });

    it('only looks up rows with valid auth values, each tuple once', async () => {
      const requests = [];
      mockGetService();
      mockFindDepots(() => [], requests);
      const batch = writeBatch({
        spec: depotOnlySpec,
        csvLines: [
          ADAM,
          'E1002,adam,B,C,1',
          'E1003,ADAM.smith@example.com,D,E,1',
        ],
      });

      await validateJson(batch);

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

    it('does not look up depots for a preauth service', async () => {
      mockGetService([
        buildService({
          authMethods: ['preauth'],
          authMode: undefined,
          verifiablePresentationAuthRules: undefined,
        }),
      ]);
      const spec = {
        ...depotOnlySpec,
        depot: { ...depotOnlySpec.depot, authValues: undefined },
      };
      const batch = writeBatch({ spec, csvLines: [ADAM, BETH] });

      const { exitCode, report } = await validateJson(batch);

      expect(exitCode).toEqual(0);
      expect(report.summary).toEqual({
        rows: 2,
        newDepots: 2,
        existingDepots: 0,
        credentials: 0,
      });
    });
  });

  describe('the operator token', () => {
    it('is read from BATCH_ISSUER_AUTH_TOKEN', async () => {
      process.env.BATCH_ISSUER_AUTH_TOKEN = AUTH_TOKEN;
      const requests = [];
      const serviceRequest = mockGetService();
      mockFindDepots(() => [], requests);
      const batch = writeBatch({ spec: depotOnlySpec, csvLines: [ADAM] });

      const result = await runCapture([
        'validate',
        batch.specFile,
        batch.csvFile,
        '--endpoint',
        HUB_URL,
      ]);

      expect(result.exitCode).toEqual(0);
      expect(serviceRequest.isDone()).toEqual(true);
      expect(requests).toHaveLength(1);
    });

    it('is required', async () => {
      const result = await runCapture([
        'validate',
        'spec.yaml',
        'rows.csv',
        '--endpoint',
        HUB_URL,
      ]);

      expect(result.exitCode).toEqual(2);
      expect(result.stderr).toContain(
        "required option '-a, --auth-token <token>' not specified",
      );
    });

    it('is never printed, even when the Hub refuses it', async () => {
      nock(HUB_URL)
        .get('/operator/issuer-services/get')
        .query(true)
        .reply(401, {
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Unauthorized',
        });
      const batch = writeBatch({ csvLines: [ADAM] });

      const result = await validate(batch);

      expect(result.exitCode).toEqual(2);
      expect(result.stdout).toEqual('');
      expect(result.stderr).toEqual(
        `Error: ${HUB_URL}/operator/issuer-services/get?tenantId=${TENANT_ID}&serviceId=${SERVICE_ID} failed: 401 Unauthorized\n`,
      );
      expect(result.stderr).not.toContain(AUTH_TOKEN);
    });
  });

  describe('exit code 2', () => {
    it('when the CSV cannot be read', async () => {
      mockGetService();
      const result = await validate({
        specFile: fixturePath('spec.yaml'),
        csvFile: '/does/not/exist.csv',
      });

      expect(result.exitCode).toEqual(2);
      expect(result.stderr).toMatch(
        /^Error: ENOENT: no such file or directory/,
      );
    });

    it('when the spec cannot be read', async () => {
      const result = await validate({
        specFile: '/does/not/exist.yaml',
        csvFile: fixturePath('holders.csv'),
      });

      expect(result.exitCode).toEqual(2);
      expect(result.stderr).toMatch(/^Error: ENOENT/);
    });

    it('when the registrar fails', async () => {
      mockGetService();
      mockFindDepots();
      nock(REGISTRAR_URL)
        .get('/api/v0.6/credential-types')
        .query(true)
        .reply(502, { message: 'Bad Gateway' });

      const result = await validate(fixtureFiles);

      expect(result.exitCode).toEqual(2);
      expect(result.stderr).toEqual(
        `Error: ${REGISTRAR_URL}/api/v0.6/credential-types?credentialType=OpenBadgeCredential failed: 502 Bad Gateway\n`,
      );
    });

    it('when the Hub cannot be reached', async () => {
      nock(HUB_URL)
        .get('/operator/issuer-services/get')
        .query(true)
        .replyWithError('connect ECONNREFUSED');

      const result = await validate(fixtureFiles);

      expect(result.exitCode).toEqual(2);
      expect(result.stderr).toContain('connect ECONNREFUSED');
    });

    it('when the endpoint is missing', async () => {
      const result = await runCapture([
        'validate',
        'spec.yaml',
        'rows.csv',
        '--auth-token',
        AUTH_TOKEN,
      ]);

      expect(result.exitCode).toEqual(2);
      expect(result.stderr).toContain(
        "required option '-e, --endpoint <url>' not specified",
      );
    });

    it('without a command', async () => {
      const result = await runCapture([]);

      expect(result.exitCode).toEqual(2);
      expect(result.stderr).toContain('Usage: batch-issuer');
    });
  });

  it('exits with 0 for --help and --version', async () => {
    const help = await runCapture(['validate', '--help']);
    const version = await runCapture(['--version']);

    expect(help.exitCode).toEqual(0);
    expect(help.stdout).toContain(
      'Usage: batch-issuer validate [options] <spec> <csv>',
    );
    expect(help.stdout).toContain('(env: BATCH_ISSUER_AUTH_TOKEN)');
    expect(version).toEqual({
      exitCode: 0,
      stdout: `${require('../package.json').version}\n`,
      stderr: '',
    });
  });
});
