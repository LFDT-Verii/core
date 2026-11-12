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

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { afterEach, describe, it } = require('node:test');
const { expect } = require('expect');
const nock = require('./helpers/nock');
const {
  mockFindDepots,
  mockGetService,
  mockRegistrar,
  mockServices,
  useNock,
} = require('./helpers/mock-services');
const {
  BATCH_ARGS,
  NETWORK,
  runCapture,
  validate,
  validateJson,
} = require('./helpers/run-cli');
const {
  ADAM,
  AUTH_TOKEN,
  HUB_URL,
  REGISTRAR_URL,
  SERVICE_ID,
  TENANT_ID,
  baseSpec,
  depotOnlySpec,
  fixturePath,
  useTempFiles,
} = require('./helpers/fixtures');
const { version } = require('../package.json');

const fixtureFiles = {
  specFile: fixturePath('spec.yaml'),
  csvFile: fixturePath('holders.csv'),
};

describe('batch-issuer validate', () => {
  useNock();
  const { writeBatch } = useTempFiles();

  afterEach(() => {
    delete process.env.BATCH_ISSUER_AUTH_TOKEN;
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
    mockServices();

    const { exitCode, report } = await validateJson(fixtureFiles);

    expect(exitCode).toEqual(0);
    expect(report).toEqual({
      valid: true,
      errors: [],
      summary: { rows: 3, newDepots: 3, existingDepots: 0, credentials: 3 },
    });
  });

  describe('a batch with batch errors and row errors', () => {
    const spec = {
      ...baseSpec,
      credentials: [
        {
          ...baseSpec.credentials[0],
          credentialReference: '{{employeeId}}-{{cohort}}',
        },
      ],
    };
    const csvLines = [
      ADAM,
      'E1002,adam,Beth,Jones,two',
      'E1003, ADAM.SMITH@example.com ,Carl,Ng,0.5',
      'E1004,dee@example.com,Dee',
    ];

    it('reports the batch errors first, then each row, and exits with 1', async () => {
      mockServices();

      const result = await validate(writeBatch({ spec, csvLines }));

      expect(result).toEqual({
        exitCode: 1,
        stdout: [
          'Batch:',
          '  - cohort: is used by the spec, but the CSV has no such column',
          '',
          'Row 2:',
          '  - email: has the same auth values as 1 other row: 4',
          '',
          'Row 3:',
          '  - email: "adam" is not an email address',
          '  - creditsEarned: "two" is not a number (template ./open-badge.template.json)',
          '',
          'Row 4:',
          '  - email: has the same auth values as 1 other row: 2',
          '',
          'Row 5:',
          '  - creditsEarned: is missing (template ./open-badge.template.json)',
          '  - lastName: is missing (template ./open-badge.template.json)',
          '',
          'The batch is not valid: 7 errors. Nothing was written to the Hub.',
          '',
        ].join('\n'),
        stderr: '',
      });
    });

    it('orders the JSON report the same way', async () => {
      mockServices();
      const template = './open-badge.template.json';

      const { exitCode, report } = await validateJson(
        writeBatch({ spec, csvLines }),
      );

      expect(exitCode).toEqual(1);
      expect(report).toEqual({
        valid: false,
        errors: [
          {
            column: 'cohort',
            reason: 'is used by the spec, but the CSV has no such column',
          },
          {
            row: 2,
            column: 'email',
            reason: 'has the same auth values as 1 other row: 4',
          },
          { row: 3, column: 'email', reason: '"adam" is not an email address' },
          {
            row: 3,
            column: 'creditsEarned',
            reason: '"two" is not a number',
            template,
          },
          {
            row: 4,
            column: 'email',
            reason: 'has the same auth values as 1 other row: 2',
          },
          { row: 5, column: 'creditsEarned', reason: 'is missing', template },
          { row: 5, column: 'lastName', reason: 'is missing', template },
        ],
        summary: { rows: 4, newDepots: 4, existingDepots: 0, credentials: 4 },
      });
    });
  });

  it('reads the operator token from BATCH_ISSUER_AUTH_TOKEN', async () => {
    process.env.BATCH_ISSUER_AUTH_TOKEN = AUTH_TOKEN;
    const serviceRequest = mockGetService();
    mockFindDepots();
    const batch = writeBatch({ spec: depotOnlySpec, csvLines: [ADAM] });

    const result = await runCapture([
      'validate',
      batch.specFile,
      batch.csvFile,
      '--endpoint',
      HUB_URL,
      '--network',
      NETWORK,
    ]);

    expect(result.exitCode).toEqual(0);
    expect(serviceRequest.isDone()).toEqual(true);
  });

  describe('usage errors exit with 2', () => {
    const usageErrors = [
      {
        name: 'without --endpoint',
        args: ['validate', 'spec.yaml', 'rows.csv', '--auth-token', AUTH_TOKEN],
        message: "error: required option '-e, --endpoint <url>' not specified",
      },
      {
        name: 'without an operator token',
        args: ['validate', 'spec.yaml', 'rows.csv', '--endpoint', HUB_URL],
        message:
          "error: required option '-a, --auth-token <token>' not specified",
      },
      {
        name: 'a --var without a name',
        args: [
          'validate',
          'spec.yaml',
          'rows.csv',
          ...BATCH_ARGS,
          '--var',
          '=3',
        ],
        message:
          "error: option '--var <name=value>' argument '=3' is invalid. Use name=value.",
      },
      {
        name: 'an unknown --default-country',
        args: [
          'validate',
          'spec.yaml',
          'rows.csv',
          ...BATCH_ARGS,
          '--default-country',
          'XX',
        ],
        message:
          "error: option '--default-country <code>' argument 'XX' is invalid. Use a two-letter country code, such as US.",
      },
      {
        name: 'no command',
        args: [],
        message: 'Usage: batch-issuer [options] [command]',
      },
    ];

    for (const { name, args, message } of usageErrors) {
      it(name, async () => {
        const result = await runCapture(args);

        expect(result.exitCode).toEqual(2);
        expect(result.stdout).toEqual('');
        expect(result.stderr).toContain(message);
      });
    }
  });

  it('exits with 0 for --help and --version', async () => {
    const help = await runCapture(['validate', '--help']);
    const versionResult = await runCapture(['--version']);

    expect(help.exitCode).toEqual(0);
    expect(help.stdout).toContain(
      'Usage: batch-issuer validate [options] <spec> <csv>',
    );
    expect(help.stdout).toContain('(env: BATCH_ISSUER_AUTH_TOKEN)');
    expect(versionResult).toEqual({
      exitCode: 0,
      stdout: `${version}\n`,
      stderr: '',
    });
  });

  describe('errors that stop validation exit with 2', () => {
    const html = '<html><body>Sign in</body></html>';
    const endpointHint =
      "Check that --endpoint is the Credentialing Hub's base URL";
    const fatalErrors = [
      {
        name: 'a CSV that cannot be read',
        files: () => ({ ...fixtureFiles, csvFile: '/does/not/exist.csv' }),
        stderr:
          "Error: ENOENT: no such file or directory, open '/does/not/exist.csv'\n",
      },
      {
        name: 'a spec that cannot be read',
        files: () => ({ ...fixtureFiles, specFile: '/does/not/exist.yaml' }),
        stderr:
          "Error: ENOENT: no such file or directory, open '/does/not/exist.yaml'\n",
      },
      {
        name: 'a Hub that refuses the token',
        mock: () =>
          nock(HUB_URL)
            .get('/operator/issuer-services/get')
            .query(true)
            .reply(401, {
              statusCode: 401,
              error: 'Unauthorized',
              message: 'Unauthorized',
            }),
        stderr: `Error: ${HUB_URL}/operator/issuer-services/get?tenantId=${TENANT_ID}&serviceId=${SERVICE_ID} failed: 401 Unauthorized\n`,
      },
      {
        name: 'a Hub that cannot be reached',
        mock: () =>
          nock(HUB_URL)
            .get('/operator/issuer-services/get')
            .query(true)
            .replyWithError('connect ECONNREFUSED'),
        stderr: expect.stringContaining('connect ECONNREFUSED'),
      },
      {
        name: 'issuer-services/get without a list of services',
        mock: () =>
          nock(HUB_URL)
            .get('/operator/issuer-services/get')
            .query(true)
            .reply(200, {}),
        stderr: `Error: operator/issuer-services/get did not return a list of services. ${endpointHint}\n`,
      },
      {
        name: 'POST depots/get answering with a login page',
        mock: () => {
          mockGetService();
          nock(HUB_URL)
            .post('/operator/depots/get')
            .reply(200, html, { 'content-type': 'text/html' });
          mockRegistrar();
        },
        stderr: `Error: operator/depots/get did not return a list of depots. ${endpointHint}\n`,
      },
      {
        name: 'a registrar that fails',
        mock: () => {
          mockGetService();
          mockFindDepots();
          nock(REGISTRAR_URL)
            .get('/api/v0.6/credential-types')
            .query(true)
            .reply(502, { message: 'Bad Gateway' });
        },
        stderr: `Error: ${REGISTRAR_URL}/api/v0.6/credential-types?credentialType=OpenBadgeCredential failed: 502 Bad Gateway\n`,
      },
    ];

    for (const {
      name,
      mock,
      files = () => fixtureFiles,
      stderr,
    } of fatalErrors) {
      it(name, async () => {
        mock?.();

        const result = await validate(files());

        expect(result).toEqual({ exitCode: 2, stdout: '', stderr });
        expect(result.stderr).not.toContain(AUTH_TOKEN);
      });
    }

    it('prints the error, not a JSON report, with --json', async () => {
      nock(HUB_URL)
        .get('/operator/issuer-services/get')
        .query(true)
        .reply(401, { message: 'Unauthorized' });

      const result = await validate(fixtureFiles, '--json');

      expect(result).toEqual({
        exitCode: 2,
        stdout: '',
        stderr: expect.stringMatching(/^Error: .+ failed: 401 Unauthorized\n$/),
      });
    });
  });

  describe('the bin', () => {
    const bin = path.join(__dirname, '..', 'src', 'index.js');
    const run = (args) =>
      spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' });

    it('prints the version and exits with 0', () => {
      const { status, stdout } = run(['--version']);

      expect({ status, stdout }).toEqual({ status: 0, stdout: `${version}\n` });
    });

    it('exits with 2 when the spec is missing', () => {
      const { status, stdout, stderr } = run([
        'validate',
        '/does/not/exist.yaml',
        'rows.csv',
        ...BATCH_ARGS,
      ]);

      expect({ status, stdout, stderr }).toEqual({
        status: 2,
        stdout: '',
        stderr:
          "Error: ENOENT: no such file or directory, open '/does/not/exist.yaml'\n",
      });
    });
  });
});
