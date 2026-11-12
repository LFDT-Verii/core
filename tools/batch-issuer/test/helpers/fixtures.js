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
const { after, before } = require('node:test');
const YAML = require('yaml');

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');
const TENANT_ID = '6512a1b2c3d4e5f6a7b8c9d0';
const SERVICE_ID = '6512a1b2c3d4e5f6a7b8c9d1';
const DEPOT_ID = '6512a1b2c3d4e5f6a7b8c9e0';
const HUB_URL = 'https://hub.example.com';
const REGISTRAR_URL = 'https://registrar.example.com';
const AUTH_TOKEN = 'secret-operator-token';
const OPEN_BADGE_SCHEMA_URL = `${REGISTRAR_URL}/schemas/open-badge-credential.schema.json`;
const TEMPLATE = './open-badge.template.json';

const fixturePath = (name) => path.join(FIXTURES_DIR, name);

const readFixture = (name) => fs.readFileSync(fixturePath(name), 'utf8');

const loadJsonFixture = (name) => JSON.parse(readFixture(name));

const baseSpec = YAML.parse(readFixture('spec.yaml'));

// The fixture spec without credentials, which a depot-only load needs to defer.
const depotOnlySpec = {
  tenantId: baseSpec.tenantId,
  serviceId: baseSpec.serviceId,
  depot: { ...baseSpec.depot, deferredCredentials: true },
};

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
  id: DEPOT_ID,
  serviceId: SERVICE_ID,
  userReference: 'E1001',
  authValues: ['adam.smith@example.com'],
  deferredCredentials: false,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  ...overrides,
});

const HEADER = 'employeeId,email,firstName,lastName,creditsEarned';
const ADAM = 'E1001,adam.smith@example.com,Adam,Smith,1.5';
const BETH = 'E1002,beth.jones@example.com,Beth,Jones,2';

const toText = (content) =>
  typeof content === 'string' ? content : JSON.stringify(content);

const toSpecText = (spec) =>
  typeof spec === 'string' ? spec : YAML.stringify(spec);

const toCsvText = (csvLines) => `${[HEADER, ...csvLines].join('\n')}\n`;

const FIXTURE_TEMPLATES = {
  'open-badge.template.json': loadJsonFixture('open-badge.template.json'),
};

/**
 * Gives a test file a temporary directory, made before its tests and removed
 * after them, and functions that write into a new directory under it.
 * @returns {{ writeBatch: Function, writeFile: Function }}
 */
const useTempFiles = () => {
  const temp = {};
  before(() => {
    temp.root = fs.mkdtempSync(path.join(os.tmpdir(), 'batch-issuer-test-'));
  });
  after(() => {
    fs.rmSync(temp.root, { recursive: true, force: true });
  });
  const newDir = () => fs.mkdtempSync(path.join(temp.root, 'batch-'));

  // A spec, a CSV and templates, with the fixture Open Badge template unless
  // it's replaced. A spec is written as YAML unless it's a string, and a CSV is
  // the header and csvLines unless csvText is given.
  const writeBatch = ({
    spec = baseSpec,
    csvLines = [],
    csvText,
    templates,
  } = {}) => {
    const dir = newDir();
    const specFile = path.join(dir, 'spec.yaml');
    const csvFile = path.join(dir, 'holders.csv');
    fs.writeFileSync(specFile, toSpecText(spec));
    fs.writeFileSync(csvFile, csvText ?? toCsvText(csvLines));
    Object.entries({ ...FIXTURE_TEMPLATES, ...templates }).forEach(
      ([name, content]) => {
        fs.writeFileSync(path.join(dir, name), toText(content));
      },
    );
    return { dir, specFile, csvFile };
  };

  const writeFile = (name, content) => {
    const file = path.join(newDir(), name);
    fs.writeFileSync(file, toText(content));
    return file;
  };

  return { writeBatch, writeFile };
};

module.exports = {
  ADAM,
  AUTH_TOKEN,
  BETH,
  DEPOT_ID,
  HEADER,
  HUB_URL,
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
  fixturePath,
  loadJsonFixture,
  phoneRule,
  useTempFiles,
};
