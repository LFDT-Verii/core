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
const os = require('node:os');
const path = require('node:path');
const YAML = require('yaml');

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');
const TENANT_ID = '6512a1b2c3d4e5f6a7b8c9d0';
const SERVICE_ID = '6512a1b2c3d4e5f6a7b8c9d1';
const HUB_URL = 'https://hub.example.com';
const REGISTRAR_URL = 'https://registrar.example.com';
const AUTH_TOKEN = 'secret-operator-token';
const OPEN_BADGE_SCHEMA_URL = `${REGISTRAR_URL}/schemas/open-badge-credential.schema.json`;

const fixturePath = (name) => path.join(FIXTURES_DIR, name);

const emailRule = {
  path: [['credentialSubject', 'email']],
  rule: 'pick',
  valueIndex: 0,
  type: 'EmailV1.0',
  valueType: 'string',
};

const phoneRule = {
  path: [['credentialSubject', 'phone']],
  rule: 'pick',
  valueIndex: 1,
  type: 'PhoneV1.0',
  valueType: 'string',
};

const buildService = (overrides = {}) => ({
  id: SERVICE_ID,
  velocityNetworkServiceId: 'did:ion:issuer#credential-issuer-1',
  termsUrl: 'https://example.com/terms',
  authMethods: ['verifiable_presentation'],
  authMode: 'internal',
  disclosureRequest: {
    types: [{ type: 'EmailV1.0' }],
    purpose: 'Identify the holder',
    retentionPeriod: 'P30D',
  },
  verifiablePresentationAuthRules: [emailRule],
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  ...overrides,
});

const buildDepot = (overrides = {}) => ({
  id: '6512a1b2c3d4e5f6a7b8c9e0',
  serviceId: SERVICE_ID,
  userReference: 'E1001',
  authValues: ['adam.smith@example.com'],
  deferredCredentials: false,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  ...overrides,
});

const baseSpec = {
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
};

const HEADER = 'employeeId,email,firstName,lastName,creditsEarned';

const makeTempDir = () =>
  fs.mkdtempSync(path.join(os.tmpdir(), 'batch-issuer-test-'));

const loadJsonFixture = (name) =>
  JSON.parse(fs.readFileSync(fixturePath(name), 'utf8'));

// Writes a spec, a CSV and templates into a new directory, with the fixture
// Open Badge template unless it's replaced. A spec is written as YAML unless
// it's a string.
const writeBatch = ({
  spec = baseSpec,
  csvLines = [],
  csvText,
  templates = {},
}) => {
  const dir = makeTempDir();
  const specFile = path.join(dir, 'spec.yaml');
  const csvFile = path.join(dir, 'holders.csv');
  fs.writeFileSync(
    specFile,
    typeof spec === 'string' ? spec : YAML.stringify(spec),
  );
  fs.writeFileSync(csvFile, csvText ?? `${[HEADER, ...csvLines].join('\n')}\n`);
  const allTemplates = {
    'open-badge.template.json': loadJsonFixture('open-badge.template.json'),
    ...templates,
  };
  Object.entries(allTemplates).forEach(([name, content]) => {
    const text =
      typeof content === 'string' ? content : JSON.stringify(content);
    fs.writeFileSync(path.join(dir, name), text);
  });
  return { dir, specFile, csvFile };
};

module.exports = {
  AUTH_TOKEN,
  HEADER,
  HUB_URL,
  OPEN_BADGE_SCHEMA_URL,
  REGISTRAR_URL,
  SERVICE_ID,
  TENANT_ID,
  baseSpec,
  buildDepot,
  buildService,
  emailRule,
  fixturePath,
  loadJsonFixture,
  makeTempDir,
  phoneRule,
  writeBatch,
};
