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

const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');
const { expect } = require('expect');
const { countBy, map } = require('lodash/fp');
const nock = require('./helpers/nock');
const { mockRegistrar, useNock } = require('./helpers/mock-services');
const {
  SHARED_LINK,
  depotLink,
  initFakeHub,
  mockHub,
  objectId,
  writeRequests,
} = require('./helpers/fake-hub');
const {
  BATCH_ARGS,
  HUB_ARGS,
  NETWORK,
  load,
  loadJson,
  runCapture,
} = require('./helpers/run-cli');
const {
  ADAM,
  AUTH_TOKEN,
  BETH,
  DEPOT_ID,
  REGISTRAR_URL,
  SERVICE_ID,
  TEMPLATE,
  TENANT_ID,
  baseSpec,
  buildDepot,
  buildService,
  depotOnlySpec,
  loadJsonFixture,
  useTempFiles,
} = require('./helpers/fixtures');

const CARL = 'E1003,carl.ng@example.com,Carl,Ng,0.5';
const OTHER_DEPOT_ID = '6512a1b2c3d4e5f6a7b8c9ff';
const ids = { tenantId: TENANT_ID, serviceId: SERVICE_ID };
const openBadge = loadJsonFixture('open-badge.template.json');

// The credential the fixture spec renders for a row.
const badgeCredential = (employeeId, name, creditsEarned) => ({
  credentialReference: `${employeeId}-ivie-2026`,
  content: {
    ...openBadge,
    credentialSubject: {
      ...openBadge.credentialSubject,
      creditsEarned,
      achievement: {
        ...openBadge.credentialSubject.achievement,
        description: `Awarded to ${name} for completing the IVIE module`,
      },
    },
  },
  tags: ['batch-2026-11'],
});

const ADAM_CREDENTIAL = badgeCredential('E1001', 'Adam Smith', 1.5);
const BETH_CREDENTIAL = badgeCredential('E1002', 'Beth Jones', 2);
const CARL_CREDENTIAL = badgeCredential('E1003', 'Carl Ng', 0.5);

const newDepot = (userReference, email, overrides = {}) => ({
  userReference,
  authValues: [email],
  expectedCredentialTypes: ['OpenBadgeCredential'],
  deferredCredentials: false,
  ...overrides,
});

const preauthDepot = (userReference) => ({
  userReference,
  expectedCredentialTypes: ['OpenBadgeCredential'],
  deferredCredentials: false,
});

const createDepotRequest = (depot) => ({
  path: 'depots/create',
  body: { ...ids, depot },
});

const createManyRequest = (items) => ({
  path: 'credentials/create-many',
  body: { tenantId: TENANT_ID, items },
});

const refreshRequest = (depotId) => ({
  path: 'issue-links/refresh',
  body: { ...ids, depotId },
});

const SHARED_LINK_REQUEST = { path: 'issue-links/refresh', body: ids };

// The depots and credentials the fake Hub creates are numbered from 1, after
// the depots it starts with.
const newDepotId = (number) => objectId('de90', number);
const credentialId = (number) => objectId('c4ed', number);

const filesOf = ({ dir }) => ({
  state: path.join(dir, 'holders.state.jsonl'),
  links: path.join(dir, 'holders.links.csv'),
});

// The state file's lines, which must all be JSON.
const readStateLines = (file) =>
  fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line));

// The records of one of the state's lists, from every line that adds to it.
const stateList = (file, key) =>
  readStateLines(file).flatMap((line) => line[key] ?? []);

const readLinks = (batch) => fs.readFileSync(filesOf(batch).links, 'utf8');

const linksCsv = (lines) =>
  `${['row,userReference,redirectUrl', ...lines].join('\n')}\n`;

const loadReport = (batch, lines) =>
  [
    ...lines,
    `Links: ${filesOf(batch).links}`,
    `State: ${filesOf(batch).state}`,
    '',
  ].join('\n');

const stoppedReport = (batch, progress) =>
  `The load stopped after creating ${progress}. ${filesOf(batch).state} records what was created. ` +
  'Rerun the same command to continue.\n';

const droppedConnection = (requestPath) =>
  `Error: https://hub.example.com/operator/${requestPath} failed: socket hang up\n`;

const preauthService = buildService({
  authMethods: ['preauth'],
  verifiablePresentationAuthRules: undefined,
  disclosureRequest: undefined,
});

const preauthSpec = {
  ...baseSpec,
  depot: { ...baseSpec.depot, authValues: undefined },
};

const conflict = () => [
  409,
  {
    statusCode: 409,
    error: 'Conflict',
    errorCode: 'auth_values_already_used',
    message: 'auth_values_already_used',
    depotId: OTHER_DEPOT_ID,
  },
];

// The Hub and the registrar for one run of the command line.
const mockRun = (hub, failures) => {
  nock.cleanAll();
  mockHub(hub, failures);
  mockRegistrar();
};

// Rows of holders numbered from 0, and depots that hold their auth values.
const holders = (count) =>
  Array.from(
    { length: count },
    (_, index) =>
      `E${2001 + index},holder${index}@example.com,Holder,${index},1`,
  );

const holderDepots = (count) =>
  Array.from({ length: count }, (_, index) =>
    buildDepot({
      id: objectId('e0', index + 1),
      userReference: `E${2001 + index}`,
      authValues: [`holder${index}@example.com`],
    }),
  );

const hasDuplicates = (values) =>
  Object.values(countBy(JSON.stringify, values)).some((count) => count > 1);

describe('batch-issuer load', () => {
  useNock();
  const { writeBatch } = useTempFiles();

  describe('an internal verifiable_presentation service', () => {
    const csvLines = [ADAM, BETH, CARL];
    // Adam already has a depot, from an earlier batch.
    const initHub = () => initFakeHub({ depots: [buildDepot()] });

    it('creates the new depots, reuses the existing one, creates the credentials and prints the shared link', async () => {
      const hub = initHub();
      const batch = writeBatch({ csvLines });
      mockRun(hub);

      const result = await load(batch);

      expect(result).toEqual({
        exitCode: 0,
        stdout: loadReport(batch, [
          'The batch is valid: 3 rows, 2 new depots, 1 existing depot, 3 credentials.',
          'Depots: 2 created, 1 reused, 0 skipped.',
          'Credentials: 3 created, 0 skipped.',
          `Issue link: ${SHARED_LINK}`,
        ]),
        stderr: '',
      });
      expect(writeRequests(hub)).toEqual([
        createDepotRequest(newDepot('E1002', 'beth.jones@example.com')),
        createDepotRequest(newDepot('E1003', 'carl.ng@example.com')),
        createManyRequest([
          { depotId: DEPOT_ID, credential: ADAM_CREDENTIAL },
          { depotId: newDepotId(2), credential: BETH_CREDENTIAL },
          { depotId: newDepotId(3), credential: CARL_CREDENTIAL },
        ]),
        SHARED_LINK_REQUEST,
      ]);
      expect(readLinks(batch)).toEqual(
        linksCsv([
          `2,E1001,${SHARED_LINK}`,
          `3,E1002,${SHARED_LINK}`,
          `4,E1003,${SHARED_LINK}`,
        ]),
      );
      expect(readStateLines(filesOf(batch).state)).toEqual([
        {
          batch: {
            network: NETWORK,
            ...ids,
            hash: expect.stringMatching(/^[0-9a-f]{64}$/),
          },
        },
        { depots: [{ row: 3, id: newDepotId(2) }] },
        { depots: [{ row: 4, id: newDepotId(3) }] },
        {
          credentials: [
            {
              row: 2,
              credentialReference: 'E1001-ivie-2026',
              id: credentialId(1),
              depotId: DEPOT_ID,
            },
            {
              row: 3,
              credentialReference: 'E1002-ivie-2026',
              id: credentialId(2),
              depotId: newDepotId(2),
            },
            {
              row: 4,
              credentialReference: 'E1003-ivie-2026',
              id: credentialId(3),
              depotId: newDepotId(3),
            },
          ],
        },
      ]);
    });

    it('prints a JSON summary with --json', async () => {
      const batch = writeBatch({ csvLines });
      mockRun(initHub());

      const { exitCode, report } = await loadJson(batch);

      expect(exitCode).toEqual(0);
      expect(report).toEqual({
        valid: true,
        errors: [],
        summary: { rows: 3, newDepots: 2, existingDepots: 1, credentials: 3 },
        load: {
          depots: { created: 2, reused: 1, skipped: 0 },
          credentials: { created: 3, skipped: 0 },
          link: SHARED_LINK,
          output: filesOf(batch).links,
          state: filesOf(batch).state,
        },
      });
    });

    it('writes the links and the state where --output and --state say', async () => {
      const batch = writeBatch({ csvLines: [BETH] });
      const output = path.join(batch.dir, 'mail-merge.csv');
      const state = path.join(batch.dir, 'november.jsonl');
      mockRun(initHub());

      const result = await load(batch, '--output', output, '--state', state);

      expect(result.exitCode).toEqual(0);
      expect(result.stdout).toContain(`Links: ${output}\nState: ${state}\n`);
      expect(fs.readFileSync(output, 'utf8')).toEqual(
        linksCsv([`2,E1002,${SHARED_LINK}`]),
      );
      expect(stateList(state, 'depots')).toEqual([
        { row: 2, id: newDepotId(2) },
      ]);
      expect(fs.existsSync(filesOf(batch).state)).toEqual(false);
    });

    it('loads depots only when the spec has no credentials', async () => {
      const hub = initFakeHub();
      const batch = writeBatch({ spec: depotOnlySpec, csvLines: [ADAM, BETH] });
      mockRun(hub);

      const result = await load(batch);

      expect(result).toEqual({
        exitCode: 0,
        stdout: loadReport(batch, [
          'The batch is valid: 2 rows, 2 new depots, 0 existing depots, 0 credentials.',
          'Depots: 2 created, 0 reused, 0 skipped.',
          'Credentials: 0 created, 0 skipped.',
          `Issue link: ${SHARED_LINK}`,
        ]),
        stderr: '',
      });
      const deferred = { deferredCredentials: true };
      expect(writeRequests(hub)).toEqual([
        createDepotRequest(
          newDepot('E1001', 'adam.smith@example.com', deferred),
        ),
        createDepotRequest(
          newDepot('E1002', 'beth.jones@example.com', deferred),
        ),
        SHARED_LINK_REQUEST,
      ]);
      expect(readLinks(batch)).toEqual(
        linksCsv([`2,E1001,${SHARED_LINK}`, `3,E1002,${SHARED_LINK}`]),
      );
    });
  });

  describe('a preauth service', () => {
    const cases = [
      {
        name: 'gives each new depot its own link',
        service: preauthService,
        spec: preauthSpec,
        depots: [],
        requests: [
          createDepotRequest(preauthDepot('E1001')),
          createDepotRequest(preauthDepot('E1002')),
          createManyRequest([
            { depotId: newDepotId(1), credential: ADAM_CREDENTIAL },
            { depotId: newDepotId(2), credential: BETH_CREDENTIAL },
          ]),
          refreshRequest(newDepotId(1)),
          refreshRequest(newDepotId(2)),
        ],
        issueLink: false,
        stateLinks: [
          { row: 2, redirectUrl: depotLink(newDepotId(1), 1) },
          { row: 3, redirectUrl: depotLink(newDepotId(2), 2) },
        ],
        links: [
          `2,E1001,${depotLink(newDepotId(1), 1)}`,
          `3,E1002,${depotLink(newDepotId(2), 2)}`,
        ],
      },
      {
        name: 'with verifiable_presentation auth too, gives a reused depot the shared link rather than refresh its link',
        service: buildService({
          authMethods: ['verifiable_presentation', 'preauth'],
        }),
        spec: baseSpec,
        depots: [buildDepot()],
        requests: [
          createDepotRequest(newDepot('E1002', 'beth.jones@example.com')),
          createManyRequest([
            { depotId: DEPOT_ID, credential: ADAM_CREDENTIAL },
            { depotId: newDepotId(2), credential: BETH_CREDENTIAL },
          ]),
          refreshRequest(newDepotId(2)),
          SHARED_LINK_REQUEST,
        ],
        issueLink: true,
        stateLinks: [{ row: 3, redirectUrl: depotLink(newDepotId(2), 1) }],
        links: [
          `2,E1001,${SHARED_LINK}`,
          `3,E1002,${depotLink(newDepotId(2), 1)}`,
        ],
      },
    ];

    for (const {
      name,
      service,
      spec,
      depots,
      requests,
      issueLink,
      stateLinks,
      links,
    } of cases) {
      it(name, async () => {
        const hub = initFakeHub({ service, depots });
        const batch = writeBatch({ spec, csvLines: [ADAM, BETH] });
        mockRun(hub);

        const result = await load(batch);

        expect(result.exitCode).toEqual(0);
        expect(result.stdout.includes(`Issue link: ${SHARED_LINK}`)).toEqual(
          issueLink,
        );
        expect(writeRequests(hub)).toEqual(requests);
        expect(stateList(filesOf(batch).state, 'links')).toEqual(stateLinks);
        expect(readLinks(batch)).toEqual(linksCsv(links));
      });
    }
  });

  describe('--resolve-deferred', () => {
    // Adam's depot waits for credentials, and Carl's doesn't.
    const initHub = () =>
      initFakeHub({
        depots: [
          buildDepot({ deferredCredentials: true }),
          buildDepot({
            id: OTHER_DEPOT_ID,
            userReference: 'E1003',
            authValues: ['carl.ng@example.com'],
          }),
        ],
      });

    const cases = [
      {
        name: "resolves a reused depot's deferred credentials once it has new ones",
        args: ['--resolve-deferred'],
        resolveRequests: [
          {
            path: 'depots/resolve-deferred-credentials',
            body: { tenantId: TENANT_ID, depotId: DEPOT_ID },
          },
        ],
        resolvedLines: ['Deferred credentials resolved: 1 depot.'],
        resolvedDepots: [DEPOT_ID],
      },
      {
        name: 'resolves nothing without it',
        args: [],
        resolveRequests: [],
        resolvedLines: [],
        resolvedDepots: [],
      },
    ];

    for (const {
      name,
      args,
      resolveRequests,
      resolvedLines,
      resolvedDepots,
    } of cases) {
      it(name, async () => {
        const hub = initHub();
        const batch = writeBatch({ csvLines: [ADAM, BETH, CARL] });
        mockRun(hub);

        const result = await load(batch, ...args);

        expect(result).toEqual({
          exitCode: 0,
          stdout: loadReport(batch, [
            'The batch is valid: 3 rows, 1 new depot, 2 existing depots, 3 credentials.',
            'Depots: 1 created, 2 reused, 0 skipped.',
            'Credentials: 3 created, 0 skipped.',
            ...resolvedLines,
            `Issue link: ${SHARED_LINK}`,
          ]),
          stderr: '',
        });
        const resolves = writeRequests(hub).filter(
          ({ path: requestPath }) =>
            requestPath === 'depots/resolve-deferred-credentials',
        );
        expect(resolves).toEqual(resolveRequests);
        expect(stateList(filesOf(batch).state, 'resolvedDepots')).toEqual(
          resolvedDepots,
        );
      });
    }
  });

  describe('--dryrun', () => {
    const batches = [
      {
        name: 'a valid batch',
        csvLines: [ADAM, BETH],
        exitCode: 0,
        stdout:
          'The batch is valid: 2 rows, 1 new depot, 1 existing depot, 2 credentials. Nothing was written to the Hub.\n',
      },
      {
        name: 'a batch with errors',
        csvLines: [ADAM, 'E1004,dee,Dee,Ng,1'],
        exitCode: 1,
        stdout: [
          'Row 3:',
          '  - email: "dee" is not an email address',
          '',
          'The batch is not valid: 1 error. Nothing was written to the Hub.',
          '',
        ].join('\n'),
      },
    ];

    for (const { name, csvLines, exitCode, stdout } of batches) {
      it(`validates ${name} as validate does, and writes nothing`, async () => {
        const hub = initFakeHub({ depots: [buildDepot()] });
        const batch = writeBatch({ csvLines });
        const args = [batch.specFile, batch.csvFile, ...BATCH_ARGS];
        const registrar = ['--registrar', REGISTRAR_URL];

        mockRun(hub);
        const validated = await runCapture(['validate', ...args, ...registrar]);
        mockRun(hub);
        const dryrun = await runCapture([
          'load',
          ...args,
          ...registrar,
          '--dryrun',
        ]);

        expect(validated).toEqual({ exitCode, stdout, stderr: '' });
        expect(dryrun).toEqual(validated);
        expect(writeRequests(hub)).toEqual([]);
        expect(fs.existsSync(filesOf(batch).state)).toEqual(false);
        expect(fs.existsSync(filesOf(batch).links)).toEqual(false);
      });
    }
  });

  describe('without --network', () => {
    for (const command of ['validate', 'load']) {
      it(`${command} is a usage error`, async () => {
        const result = await runCapture([
          command,
          'spec.yaml',
          'holders.csv',
          ...HUB_ARGS,
        ]);

        expect(result).toEqual({
          exitCode: 2,
          stdout: '',
          stderr: "error: required option '--network <name>' not specified\n",
        });
      });
    }
  });

  it('writes nothing when the batch has errors', async () => {
    const hub = initFakeHub();
    const batch = writeBatch({ csvLines: [ADAM, 'E1004,dee,Dee,Ng,1'] });
    mockRun(hub);

    const result = await load(batch);

    expect(result).toEqual({
      exitCode: 1,
      stdout: [
        'Row 3:',
        '  - email: "dee" is not an email address',
        '',
        'The batch is not valid: 1 error. Nothing was written to the Hub.',
        '',
      ].join('\n'),
      stderr: '',
    });
    expect(writeRequests(hub)).toEqual([]);
    expect(fs.existsSync(filesOf(batch).state)).toEqual(false);
    expect(fs.existsSync(filesOf(batch).links)).toEqual(false);
  });

  describe('a depot that another client created after validation', () => {
    const failures = { 'depots/create': { at: 2, reply: conflict } };
    const reason = `the auth values belong to depot ${OTHER_DEPOT_ID}, which another client created after validation`;

    it('stops the load, reports the row and exits with 2', async () => {
      const hub = initFakeHub();
      const batch = writeBatch({ csvLines: [ADAM, BETH, CARL] });
      mockRun(hub, failures);

      const result = await load(batch);

      expect(result).toEqual({
        exitCode: 2,
        stdout:
          'The batch is valid: 3 rows, 3 new depots, 0 existing depots, 3 credentials.\n',
        stderr: [
          'Row 3:',
          `  - email: ${reason}`,
          '',
          'Error: depots/create refused a depot',
          stoppedReport(batch, '1 of 3 depots and 0 of 3 credentials'),
        ].join('\n'),
      });
      expect(writeRequests(hub)).toEqual([
        createDepotRequest(newDepot('E1001', 'adam.smith@example.com')),
        createDepotRequest(newDepot('E1002', 'beth.jones@example.com')),
      ]);
      expect(stateList(filesOf(batch).state, 'depots')).toEqual([
        { row: 2, id: newDepotId(1) },
      ]);
      expect(fs.existsSync(filesOf(batch).links)).toEqual(false);
    });

    it('reports it in the JSON summary with --json', async () => {
      const batch = writeBatch({ csvLines: [ADAM, BETH, CARL] });
      mockRun(initFakeHub(), failures);

      const { exitCode, stderr, report } = await loadJson(batch);

      expect({ exitCode, stderr }).toEqual({ exitCode: 2, stderr: '' });
      expect(report.load).toEqual({
        depots: { created: 1, reused: 0, skipped: 0 },
        credentials: { created: 0, skipped: 0 },
        state: filesOf(batch).state,
        error: {
          message: 'depots/create refused a depot',
          errors: [{ row: 3, column: 'email', reason }],
        },
      });
    });
  });

  it('maps the credentials that create-many refuses to their rows and templates', async () => {
    const secondTemplate = './second-badge.template.json';
    const spec = {
      ...baseSpec,
      credentials: [
        ...baseSpec.credentials,
        {
          template: secondTemplate,
          credentialReference: '{{employeeId}}-ivie-2026-copy',
        },
      ],
    };
    const itemErrors = [
      {
        index: 1,
        path: '/items/1/credential/content/credentialSubject/creditsEarned',
        errorCode: 'request_validation_failed',
        message:
          'credential.content.credentialSubject/creditsEarned must be <= 1',
      },
      {
        index: 2,
        path: '/items/2/credential/content/type',
        errorCode: 'credential_type_not_expected',
        message: 'credential_type_not_expected',
      },
    ];
    const refuse = () => [
      400,
      {
        statusCode: 400,
        error: 'Bad Request',
        errorCode: 'request_validation_failed',
        message: itemErrors[0].message,
        errors: itemErrors,
      },
    ];
    const hub = initFakeHub();
    const batch = writeBatch({
      spec,
      csvLines: [ADAM, BETH],
      templates: { 'second-badge.template.json': openBadge },
    });
    mockRun(hub, { 'credentials/create-many': { at: 1, reply: refuse } });

    const result = await load(batch);

    expect(result.exitCode).toEqual(2);
    expect(result.stderr).toEqual(
      [
        'Row 2:',
        `  - ${itemErrors[0].message} (template ${secondTemplate})`,
        '',
        'Row 3:',
        `  - credential_type_not_expected (template ${TEMPLATE})`,
        '',
        'Error: credentials/create-many refused 2 credentials, so it created none of the 4 credentials in its request',
        stoppedReport(batch, '2 of 2 depots and 0 of 4 credentials'),
      ].join('\n'),
    );
    const references = writeRequests(hub)[2].body.items.map(
      ({ credential }) => credential.credentialReference,
    );
    expect(references).toEqual([
      'E1001-ivie-2026',
      'E1001-ivie-2026-copy',
      'E1002-ivie-2026',
      'E1002-ivie-2026-copy',
    ]);
    expect(hub.credentials).toEqual([]);
    expect(stateList(filesOf(batch).state, 'credentials')).toEqual([]);
  });

  it('creates more than 1,000 credentials in requests of at most 1,000', async () => {
    const hub = initFakeHub({ depots: holderDepots(1001) });
    const batch = writeBatch({ csvLines: holders(1001) });
    mockRun(hub);

    const result = await load(batch);

    expect(result.exitCode).toEqual(0);
    expect(result.stdout).toContain(
      'Depots: 0 created, 1,001 reused, 0 skipped.\nCredentials: 1,001 created, 0 skipped.\n',
    );
    const createMany = writeRequests(hub).filter(
      ({ path: requestPath }) => requestPath === 'credentials/create-many',
    );
    expect(map(({ body }) => body.items.length, createMany)).toEqual([1000, 1]);
    expect(createMany[1].body.items[0]).toEqual({
      depotId: objectId('e0', 1001),
      credential: expect.objectContaining({
        credentialReference: 'E3001-ivie-2026',
      }),
    });
    expect(hub.credentials).toHaveLength(1001);
  });

  describe('a rerun after a dropped connection', () => {
    const cases = [
      {
        name: 'partway through the depots',
        initHub: () => initFakeHub(),
        csvLines: [ADAM, BETH, CARL],
        failures: { 'depots/create': { at: 2 } },
        failedPath: 'depots/create',
        progress: '1 of 3 depots and 0 of 3 credentials',
        rerun: [
          'Depots: 2 created, 0 reused, 1 skipped.',
          'Credentials: 3 created, 0 skipped.',
        ],
        depots: 3,
        credentials: 3,
        refreshes: 0,
      },
      {
        name: 'partway through the credentials',
        // Every holder but the last has a depot already.
        initHub: () => initFakeHub({ depots: holderDepots(1000) }),
        csvLines: holders(1001),
        failures: { 'credentials/create-many': { at: 2 } },
        failedPath: 'credentials/create-many',
        progress: '1 of 1 depot and 1,000 of 1,001 credentials',
        rerun: [
          'Depots: 0 created, 1,000 reused, 1 skipped.',
          'Credentials: 1 created, 1,000 skipped.',
        ],
        depots: 1001,
        credentials: 1001,
        refreshes: 0,
      },
      {
        name: "partway through a preauth service's depots, which can't be found by auth values",
        initHub: () => initFakeHub({ service: preauthService }),
        spec: preauthSpec,
        csvLines: [ADAM, BETH, CARL],
        failures: { 'depots/create': { at: 2 } },
        failedPath: 'depots/create',
        progress: '1 of 3 depots and 0 of 3 credentials',
        rerun: [
          'Depots: 2 created, 0 reused, 1 skipped.',
          'Credentials: 3 created, 0 skipped.',
        ],
        depots: 3,
        credentials: 3,
        refreshes: 3,
      },
      {
        name: "partway through a preauth service's links",
        initHub: () => initFakeHub({ service: preauthService }),
        spec: preauthSpec,
        csvLines: [ADAM, BETH, CARL],
        failures: { 'issue-links/refresh': { at: 2 } },
        failedPath: 'issue-links/refresh',
        progress: '3 of 3 depots and 3 of 3 credentials',
        rerun: [
          'Depots: 0 created, 0 reused, 3 skipped.',
          'Credentials: 0 created, 3 skipped.',
        ],
        depots: 3,
        credentials: 3,
        refreshes: 3,
      },
    ];

    for (const {
      name,
      initHub,
      spec,
      csvLines,
      failures,
      failedPath,
      progress,
      rerun,
      depots,
      credentials,
      refreshes,
    } of cases) {
      it(`${name} finishes the load without duplicating anything`, async () => {
        const hub = initHub();
        const batch = writeBatch({ spec, csvLines });

        mockRun(hub, failures);
        const stopped = await load(batch);
        mockRun(hub);
        const finished = await load(batch);

        expect(stopped.exitCode).toEqual(2);
        expect(stopped.stderr).toEqual(
          `${droppedConnection(failedPath)}${stoppedReport(batch, progress)}`,
        );
        expect(finished.exitCode).toEqual(0);
        expect(finished.stdout).toContain(`\n${rerun.join('\n')}\n`);
        expect(hub.depots).toHaveLength(depots);
        expect(hub.credentials).toHaveLength(credentials);
        expect(hasDuplicates(map('userReference', hub.depots))).toEqual(false);
        expect(
          hasDuplicates(map('credentialReference', hub.credentials)),
        ).toEqual(false);
        // Each new depot's link is refreshed once, so the links already
        // written stay valid.
        expect(hub.refreshes).toEqual(refreshes);
      });
    }
  });

  describe('a last line that a crash left unfinished', () => {
    const cases = [
      {
        name: 'is ignored when it was torn, so the rerun finds the depot again by its auth values',
        finish: (line) => line.slice(0, 20),
        depots: 'Depots: 1 created, 1 reused, 1 skipped.',
        depotLines: [
          { depots: [{ row: 2, id: newDepotId(1) }] },
          { depots: [{ row: 4, id: newDepotId(3) }] },
        ],
      },
      {
        name: 'is kept when only its newline is missing',
        finish: (line) => line,
        depots: 'Depots: 1 created, 0 reused, 2 skipped.',
        depotLines: [
          { depots: [{ row: 2, id: newDepotId(1) }] },
          { depots: [{ row: 3, id: newDepotId(2) }] },
          { depots: [{ row: 4, id: newDepotId(3) }] },
        ],
      },
    ];

    for (const { name, finish, depots, depotLines } of cases) {
      it(`${name}, and the rerun finishes without duplicates`, async () => {
        const hub = initFakeHub();
        const batch = writeBatch({ csvLines: [ADAM, BETH, CARL] });
        const { state } = filesOf(batch);
        mockRun(hub, { 'depots/create': { at: 3 } });
        await load(batch);
        // The crash came as the line of Beth's depot was written.
        const [batchLine, adamLine, bethLine] = fs
          .readFileSync(state, 'utf8')
          .split('\n');
        fs.writeFileSync(
          state,
          `${batchLine}\n${adamLine}\n${finish(bethLine)}`,
        );

        mockRun(hub);
        const result = await load(batch);

        expect(result.exitCode).toEqual(0);
        expect(result.stdout).toContain(
          `\n${depots}\nCredentials: 3 created, 0 skipped.\n`,
        );
        expect(hub.depots).toHaveLength(3);
        expect(hub.credentials).toHaveLength(3);
        expect(
          hasDuplicates(map('credentialReference', hub.credentials)),
        ).toEqual(false);
        expect(readStateLines(state)).toEqual([
          JSON.parse(batchLine),
          ...depotLines,
          { credentials: expect.any(Array) },
        ]);
      });
    }
  });

  it("starts the state file again when the crash tore the batch's line", async () => {
    const hub = initFakeHub();
    const batch = writeBatch({ csvLines: [ADAM] });
    const { state } = filesOf(batch);
    fs.writeFileSync(state, '{"batch":{"tenantId":"65');
    mockRun(hub);

    const result = await load(batch);

    expect(result.exitCode).toEqual(0);
    expect(readStateLines(state)).toEqual([
      { batch: { network: NETWORK, ...ids, hash: expect.any(String) } },
      { depots: [{ row: 2, id: newDepotId(1) }] },
      { credentials: [expect.objectContaining({ row: 2 })] },
    ]);
  });

  describe('a state file that cannot be read', () => {
    const cases = [
      {
        name: 'a line other than the last is not JSON',
        stateFile: ({ dir }) => {
          const file = path.join(dir, 'holders.state.jsonl');
          fs.writeFileSync(
            file,
            `${JSON.stringify({ batch: ids })}\n{"depots":[{"row":2\n{"depots":[]}\n`,
          );
          return file;
        },
        stderr: (file) =>
          `Error: the state file ${file} has a line that isn't JSON: line 2\n`,
      },
      {
        name: 'it is a directory',
        stateFile: ({ dir }) => dir,
        stderr: (file) =>
          expect.stringMatching(
            new RegExp(`^Error: the state file ${file} can't be read: EISDIR`),
          ),
      },
    ];

    for (const { name, stateFile, stderr } of cases) {
      it(`stops the load when ${name}`, async () => {
        const hub = initFakeHub();
        const batch = writeBatch({ csvLines: [ADAM] });
        const file = stateFile(batch);
        mockRun(hub);

        const result = await load(batch, '--state', file);

        expect(result).toEqual({
          exitCode: 2,
          stdout: '',
          stderr: stderr(file),
        });
        expect(writeRequests(hub)).toEqual([]);
      });
    }
  });

  it(
    'creates the state file and the links file for their owner only',
    { skip: process.platform === 'win32' },
    async () => {
      const batch = writeBatch({ spec: preauthSpec, csvLines: [ADAM] });
      mockRun(initFakeHub({ service: preauthService }));

      await load(batch);

      // The permission bits are the mode's last three octal digits.
      const modeOf = (file) => fs.statSync(file).mode.toString(8).slice(-3);
      expect(map(modeOf, filesOf(batch))).toEqual(['600', '600']);
    },
  );

  describe('a rerun of a finished load', () => {
    const cases = [
      {
        name: 'an internal verifiable_presentation service',
        initHub: () => initFakeHub({ depots: [buildDepot()] }),
        spec: baseSpec,
        depots: 'Depots: 0 created, 1 reused, 2 skipped.',
        requests: [SHARED_LINK_REQUEST],
      },
      {
        name: 'a preauth service',
        initHub: () => initFakeHub({ service: preauthService }),
        spec: preauthSpec,
        depots: 'Depots: 0 created, 0 reused, 3 skipped.',
        requests: [],
      },
    ];

    for (const { name, initHub, spec, depots, requests } of cases) {
      it(`creates nothing and writes the same links for ${name}`, async () => {
        const hub = initHub();
        const batch = writeBatch({ spec, csvLines: [ADAM, BETH, CARL] });
        mockRun(hub);
        await load(batch);
        const links = readLinks(batch);
        const firstRunWrites = writeRequests(hub).length;

        mockRun(hub);
        const result = await load(batch);

        expect(result.exitCode).toEqual(0);
        expect(result.stdout).toContain(
          `\n${depots}\nCredentials: 0 created, 3 skipped.\n`,
        );
        expect(writeRequests(hub).slice(firstRunWrites)).toEqual(requests);
        expect(readLinks(batch)).toEqual(links);
      });
    }
  });

  describe('--no-reuse on a rerun', () => {
    const cases = [
      {
        name: 'accepts the depots that the earlier run created',
        depots: [],
        csvLines: [BETH, CARL],
        exitCode: 0,
        stdout: expect.stringContaining(
          '\nDepots: 0 created, 0 reused, 2 skipped.\nCredentials: 2 created, 0 skipped.\n',
        ),
      },
      {
        name: 'still refuses a depot that the batch did not create',
        depots: [buildDepot()],
        csvLines: [ADAM, BETH],
        exitCode: 1,
        stdout: [
          'Row 2:',
          `  - email: the auth values belong to depot ${DEPOT_ID}, and --no-reuse is set`,
          '',
          'The batch is not valid: 1 error. Nothing was written to the Hub.',
          '',
        ].join('\n'),
      },
    ];

    for (const { name, depots, csvLines, exitCode, stdout } of cases) {
      it(name, async () => {
        const hub = initFakeHub({ depots });
        const batch = writeBatch({ csvLines });
        mockRun(hub, { 'credentials/create-many': { at: 1 } });
        const stopped = await load(batch);

        mockRun(hub);
        const result = await load(batch, '--no-reuse');

        expect(stopped.exitCode).toEqual(2);
        expect(result).toEqual({ exitCode, stdout, stderr: '' });
      });
    }
  });

  describe('a state file of another batch', () => {
    const changes = [
      {
        name: 'a changed CSV',
        change: ({ csvFile }) => fs.appendFileSync(csvFile, `${CARL}\n`),
      },
      {
        name: 'a changed template',
        change: ({ dir }) =>
          fs.writeFileSync(
            path.join(dir, 'open-badge.template.json'),
            JSON.stringify({ ...openBadge, name: 'IVIE' }),
          ),
      },
      {
        name: 'a changed spec',
        change: ({ specFile }) =>
          fs.appendFileSync(specFile, '# a new comment\n'),
      },
      { name: 'another --var', args: ['--var', 'lastName=Doe'] },
      { name: 'a --default-country', args: ['--default-country', 'US'] },
      { name: 'another --network', args: ['--network', 'testnet'] },
    ];

    for (const { name, change, args = [] } of changes) {
      it(`is refused after ${name}, and nothing is written`, async () => {
        const hub = initFakeHub();
        const batch = writeBatch({ csvLines: [ADAM, BETH] });
        mockRun(hub);
        await load(batch);
        const firstRunWrites = writeRequests(hub).length;
        change?.(batch);

        mockRun(hub);
        const result = await load(batch, ...args);

        expect(result).toEqual({
          exitCode: 2,
          stdout: '',
          stderr:
            `Error: the state file ${filesOf(batch).state} belongs to a different batch: the spec, its templates, the CSV, ` +
            '--network, --var or --default-country have changed since it was written. Rerun the batch it belongs to, or pass another --state\n',
        });
        expect(writeRequests(hub)).toHaveLength(firstRunWrites);
      });
    }

    it('is not another batch for the same --network in another case', async () => {
      const hub = initFakeHub();
      const batch = writeBatch({ csvLines: [ADAM, BETH] });
      mockRun(hub);
      await load(batch);

      mockRun(hub);
      const result = await load(batch, '--network', 'DevNet');

      expect(result.exitCode).toEqual(0);
      expect(result.stdout).toContain(
        '\nDepots: 0 created, 0 reused, 2 skipped.\nCredentials: 0 created, 2 skipped.\n',
      );
    });

    it('is refused by validate too', async () => {
      const hub = initFakeHub();
      const batch = writeBatch({ csvLines: [ADAM] });
      mockRun(hub);
      await load(batch);
      fs.appendFileSync(batch.csvFile, `${BETH}\n`);

      mockRun(hub);
      const result = await runCapture([
        'validate',
        batch.specFile,
        batch.csvFile,
        ...BATCH_ARGS,
        '--registrar',
        REGISTRAR_URL,
      ]);

      expect(result.exitCode).toEqual(2);
      expect(result.stderr).toContain('belongs to a different batch');
    });
  });

  describe('the operator token', () => {
    const outcomes = [
      { name: 'a load', failures: {} },
      {
        name: 'a refused depot',
        failures: { 'depots/create': { at: 1, reply: conflict } },
      },
      {
        name: 'a dropped connection',
        failures: { 'credentials/create-many': { at: 1 } },
      },
      {
        name: 'a refused token',
        failures: {
          'issue-links/refresh': {
            at: 1,
            reply: () => [401, { statusCode: 401, message: 'Unauthorized' }],
          },
        },
      },
    ];

    for (const { name, failures } of outcomes) {
      for (const format of [[], ['--json']]) {
        it(`is never printed or written after ${name} ${format.join(' ')}`, async () => {
          const batch = writeBatch({ csvLines: [ADAM, BETH] });
          mockRun(initFakeHub(), failures);

          const { stdout, stderr } = await load(batch, ...format);

          const written = [filesOf(batch).state, filesOf(batch).links]
            .filter((file) => fs.existsSync(file))
            .map((file) => fs.readFileSync(file, 'utf8'));
          expect([stdout, stderr, ...written].join('\n')).not.toContain(
            AUTH_TOKEN,
          );
        });
      }
    }
  });
});
