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
const nock = require('./helpers/nock');
const { HUB_ARGS, runCapture } = require('./helpers/run-cli');
const { mockGetService, useNock } = require('./helpers/mock-services');
const {
  AUTH_TOKEN,
  HUB_URL,
  SERVICE_ID,
  TENANT_ID,
  baseSpec,
  buildService,
  emailRule,
  fixturePath,
  phoneRule,
  useTempFiles,
} = require('./helpers/fixtures');

const b64url = (value) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

// A VC 1.1 JWT. check-rules only decodes it, so the signature is a placeholder.
const buildJwtVc = (vc) =>
  [
    b64url({ alg: 'ES256K', typ: 'JWT', kid: 'did:ion:issuer#key-1' }),
    b64url({
      iss: 'did:ion:issuer',
      sub: 'did:jwk:holder',
      jti: 'did:velocity:v2:1',
      nbf: 1700000000,
      vc,
    }),
    'c2lnbmF0dXJl',
  ].join('.');

const emailCredential = {
  type: ['EmailV1.0', 'VerifiableCredential'],
  credentialSubject: { email: ' Adam.Smith@Example.com' },
};

const phoneCredential = {
  type: ['PhoneV1.0', 'VerifiableCredential'],
  credentialSubject: { phones: ['+15556192191', '+61412345678'] },
};

const checkRulesWithSpec = (specFile, ...args) =>
  runCapture(['check-rules', specFile, ...HUB_ARGS, ...args]);

const checkRules = (...args) =>
  checkRulesWithSpec(fixturePath('spec.yaml'), ...args);

describe('batch-issuer check-rules', () => {
  useNock();
  const { writeBatch, writeFile } = useTempFiles();
  const writeSample = (name, content) =>
    writeFile(name, typeof content === 'string' ? `${content}\n` : content);

  it('shows what each rule reads from a JSON credential', async () => {
    const serviceRequest = mockGetService();
    const sample = writeSample('email.json', emailCredential);

    const result = await checkRules('--sample', sample);

    expect(serviceRequest.isDone()).toEqual(true);
    expect(result).toEqual({
      exitCode: 0,
      stdout: [
        `Samples: ${sample} (EmailV1.0)`,
        '',
        'Rule 0: EmailV1.0, pick, string',
        `  ${sample}`,
        '    ["credentialSubject","email"] selects [" Adam.Smith@Example.com"]',
        '  values: "adam.smith@example.com"',
        '',
        '1 of 1 rule read a value from the samples.',
        '',
      ].join('\n'),
      stderr: '',
    });
  });

  it('decodes a JWT as the Hub decodes a presented credential', async () => {
    mockGetService([
      buildService({
        verifiablePresentationAuthRules: [
          {
            ...emailRule,
            path: [
              ['credentialSubject', 'id'],
              ['credentialSubject', 'email'],
            ],
          },
        ],
      }),
    ]);
    const sample = writeSample('email.jwt', buildJwtVc(emailCredential));

    const result = await checkRules('--sample', sample, '--json');

    expect(result.exitCode).toEqual(0);
    expect(JSON.parse(result.stdout)).toEqual({
      samples: [{ file: sample, type: 'EmailV1.0' }],
      rules: [
        {
          rule: {
            ...emailRule,
            path: [
              ['credentialSubject', 'id'],
              ['credentialSubject', 'email'],
            ],
          },
          samples: [
            {
              file: sample,
              pointers: [
                {
                  pointer: ['credentialSubject', 'id'],
                  selected: ['did:jwk:holder'],
                },
                {
                  pointer: ['credentialSubject', 'email'],
                  selected: [' Adam.Smith@Example.com'],
                },
              ],
            },
          ],
          values: ['did:jwk:holder'],
          candidateValues: ['did:jwk:holder'],
        },
      ],
    });
  });

  it('reads each rule from the samples of its type, and exits with 1 when a rule reads nothing', async () => {
    const equalPhoneRule = {
      ...phoneRule,
      rule: 'equal',
      valueType: 'string',
      valueFormat: 'e164',
      path: [
        ['credentialSubject', 'phone'],
        ['credentialSubject', 'phones', null],
      ],
    };
    mockGetService([
      buildService({
        verifiablePresentationAuthRules: [equalPhoneRule, emailRule],
      }),
    ]);
    const emailSample = writeSample('email.json', emailCredential);
    const phoneSample = writeSample('phone.json', phoneCredential);

    const result = await checkRules('--sample', emailSample, phoneSample);

    expect(result).toEqual({
      exitCode: 1,
      stdout: [
        `Samples: ${emailSample} (EmailV1.0), ${phoneSample} (PhoneV1.0)`,
        '',
        'Rule 0: EmailV1.0, pick, string',
        `  ${emailSample}`,
        '    ["credentialSubject","email"] selects [" Adam.Smith@Example.com"]',
        '  values: "adam.smith@example.com"',
        '',
        'Rule 1: PhoneV1.0, equal, string, e164',
        `  ${phoneSample}`,
        '    ["credentialSubject","phone"] selects []',
        '    ["credentialSubject","phones",null] selects ["+15556192191","+61412345678"]',
        '  values: "+15556192191", "+61412345678", but equal uses a value only when there is exactly one, so the rule reads nothing',
        '',
        '1 of 2 rules read a value from the samples.',
        '',
      ].join('\n'),
      stderr: '',
    });
  });

  it("says when no sample is of a rule's type", async () => {
    mockGetService([
      buildService({ verifiablePresentationAuthRules: [emailRule, phoneRule] }),
    ]);
    const sample = writeSample('email.json', emailCredential);

    const result = await checkRules('--sample', sample);

    expect(result.exitCode).toEqual(1);
    expect(result.stdout).toContain(
      [
        'Rule 1: PhoneV1.0, pick, string',
        '  no sample is a PhoneV1.0',
        '  values: none',
      ].join('\n'),
    );
  });

  it("doesn't need the spec's template files", async () => {
    mockGetService();
    const spec = {
      ...baseSpec,
      credentials: [{ template: './missing.json', credentialReference: 'x' }],
    };
    const { specFile } = writeBatch({ spec });

    const result = await checkRulesWithSpec(
      specFile,
      '--sample',
      writeSample('email.json', emailCredential),
    );

    expect(result.exitCode).toEqual(0);
    expect(result.stdout).toContain(
      '1 of 1 rule read a value from the samples.',
    );
  });

  describe('exit code 2', () => {
    it('when the sample is neither JSON nor a JWT', async () => {
      mockGetService();
      const sample = writeSample('email.txt', 'not a credential');

      const result = await checkRules('--sample', sample);

      expect(result.exitCode).toEqual(2);
      expect(result.stderr).toMatch(
        new RegExp(
          `^Error: the sample ${sample} is not a JSON credential or a JWT: `,
        ),
      );
    });

    it('when the service is missing', async () => {
      mockGetService([]);

      const result = await checkRules(
        '--sample',
        writeSample('email.json', emailCredential),
      );

      expect(result).toEqual({
        exitCode: 2,
        stdout: '',
        stderr: `Error: tenant ${TENANT_ID} has no issuer service ${SERVICE_ID}\n`,
      });
    });

    it('when the service has no auth rules', async () => {
      mockGetService([
        buildService({
          authMethods: ['preauth'],
          verifiablePresentationAuthRules: undefined,
        }),
      ]);

      const result = await checkRules(
        '--sample',
        writeSample('email.json', emailCredential),
      );

      expect(result.exitCode).toEqual(2);
      expect(result.stderr).toEqual(
        `Error: service ${SERVICE_ID} has no verifiablePresentationAuthRules\n`,
      );
    });

    it('when the spec has errors', async () => {
      const { specFile } = writeBatch({ spec: 'tenantId: t1\n' });

      const result = await checkRulesWithSpec(
        specFile,
        '--sample',
        'sample.json',
      );

      expect(result).toEqual({
        exitCode: 2,
        stdout: '',
        stderr:
          "Error: spec must have required property 'serviceId'; spec must have required property 'depot'\n",
      });
    });

    it('when the Hub refuses the token, which is never printed', async () => {
      nock(HUB_URL)
        .get('/operator/issuer-services/get')
        .query(true)
        .reply(401, { message: 'Unauthorized' });

      const result = await checkRules(
        '--sample',
        writeSample('email.json', emailCredential),
      );

      expect(result).toEqual({
        exitCode: 2,
        stdout: '',
        stderr: `Error: ${HUB_URL}/operator/issuer-services/get?tenantId=${TENANT_ID}&serviceId=${SERVICE_ID} failed: 401 Unauthorized\n`,
      });
      expect(result.stderr).not.toContain(AUTH_TOKEN);
    });

    it('without --sample', async () => {
      const result = await checkRules();

      expect(result.exitCode).toEqual(2);
      expect(result.stderr).toContain(
        "required option '-s, --sample <credential...>' not specified",
      );
    });
  });
});
