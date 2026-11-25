/**
 * Copyright 2023 Velocity Team
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

const { beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');

const { Writable } = require('node:stream');
const { get, omit, set } = require('lodash/fp');
const pino = require('pino');
const { HUB_CLIENT_REDACT_PATHS, loggerProvider } = require('../index');

const store = {};
const CENSOR = '...shhh...';
const sensitiveDataForLog = () => ({
  operatorApiToken: 'static-token',
  clientSecret: 'client-secret',
  client_secret: 'oauth-client-secret',
  vnfClientId: 'vnf-client-id',
  vnfClientSecret: 'vnf-client-secret',
  blockchainCredentials: {
    secretId: 'kms-secret-id',
  },
  provisioningCode: 'provisioning-code',
  headers: {
    authorization: 'Basic Y2xpZW50OnNlY3JldA==',
    'x-provisioning-code': 'provisioning-code',
  },
  body: {
    access_token: 'jwt',
    clientSecret: 'returned-secret',
    vnfClientId: 'submitted-vnf-client-id',
    vnfClientSecret: 'submitted-vnf-secret',
    blockchainCredentials: {
      secretId: 'submitted-kms-secret-id',
    },
  },
});

const additionalSensitiveDataForLog = () => ({
  cao: {
    blockchainCredentials: {
      secretId: 'cao-kms-secret-id',
    },
  },
  body: {
    client_secret: 'submitted-oauth-client-secret',
    provisioningCode: 'submitted-provisioning-code',
  },
});

const expectSensitiveDataToBeRedacted = (output) => {
  for (const secret of [
    'static-token',
    'client-secret',
    'oauth-client-secret',
    'vnf-client-secret',
    'kms-secret-id',
    'Basic Y2xpZW50OnNlY3JldA==',
    'jwt',
    'returned-secret',
    'submitted-vnf-secret',
    'submitted-kms-secret-id',
  ]) {
    expect(output).not.toContain(secret);
  }
  expect(output).not.toContain('"provisioningCode":"provisioning-code"');
  expect(output).not.toContain('"x-provisioning-code":"provisioning-code"');

  expect(JSON.parse(output)).toMatchObject({
    operatorApiToken: CENSOR,
    clientSecret: CENSOR,
    client_secret: CENSOR,
    vnfClientId: 'vnf-client-id',
    vnfClientSecret: CENSOR,
    blockchainCredentials: { secretId: CENSOR },
    provisioningCode: CENSOR,
    headers: {
      authorization: CENSOR,
      'x-provisioning-code': CENSOR,
    },
    body: {
      access_token: CENSOR,
      clientSecret: CENSOR,
      vnfClientId: 'submitted-vnf-client-id',
      vnfClientSecret: CENSOR,
      blockchainCredentials: { secretId: CENSOR },
    },
  });
};

const expectAdditionalSensitiveDataToBeRedacted = (output) => {
  for (const secret of [
    'cao-kms-secret-id',
    'submitted-oauth-client-secret',
    'submitted-provisioning-code',
  ]) {
    expect(output).not.toContain(secret);
  }

  expect(JSON.parse(output)).toMatchObject({
    cao: { blockchainCredentials: { secretId: CENSOR } },
    body: {
      client_secret: CENSOR,
      provisioningCode: CENSOR,
    },
  });
};

class MemoryStream extends Writable {
  constructor(key, options) {
    super(options);
    this.key = key;
    store[this.key] = Buffer.from('');
  }

  _write(chunk, enc, cb) {
    store[this.key] = Buffer.concat([store[this.key], Buffer.from(chunk, enc)]);
    cb();
  }

  reset() {
    store[this.key] = Buffer.from('');
  }

  toString() {
    return store[this.key].toString();
  }
}

describe('Test pino logger provider with redaction', () => {
  const logStream = new MemoryStream('log');

  const log = loggerProvider({
    nodeEnv: 'test',
    logSeverity: 'info',
    version: '1.0',
    traceIdHeader: 'x-trace-id',
    destination: logStream,
  });

  beforeEach(() => {
    logStream.reset();
  });

  it('should correctly serialize request object', () => {
    const mockReq = {
      method: 'GET',
      url: '/test',
      headers: {
        'accept-version': '1.0.0',
        'x-trace-id': '1234',
        authorization:
          // eslint-disable-next-line max-len
          'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoidmVsb2NpdHkuYWRtaW5AZXhhbXBsZS5jb20ifQ.EoDg_46Qi28tScPD5xwHW4TCdEtN8-gzYoAgFa34fCQ',
      },
      hostname: 'localhost',
      ip: '127.0.0.1',
      socket: { remotePort: 8080 },
    };
    const { req } = log[Symbol.for('pino.serializers')];
    const serialized = req(mockReq);
    expect(serialized).toStrictEqual({
      hostname: 'localhost',
      method: 'GET',
      remoteAddress: '127.0.0.1',
      remotePort: 8080,
      serverVersion: '1.0',
      traceId: '1234',
      url: '/test',
      userId: 'velocity.admin@example.com',
      version: '1.0.0',
    });
  });

  it('should correctly serialize request object without authorization', () => {
    const mockReq = {
      method: 'GET',
      url: '/test',
      headers: {
        'accept-version': '1.0.0',
        'x-trace-id': '1234',
      },
      hostname: 'localhost',
      ip: '127.0.0.1',
      socket: { remotePort: 8080 },
    };
    const { req } = log[Symbol.for('pino.serializers')];
    const serialized = req(mockReq);
    expect(serialized).toStrictEqual({
      hostname: 'localhost',
      method: 'GET',
      remoteAddress: '127.0.0.1',
      remotePort: 8080,
      serverVersion: '1.0',
      traceId: '1234',
      url: '/test',
      version: '1.0.0',
    });
  });

  it('should correctly serialize request object with wrong authorization', () => {
    const mockReq = {
      method: 'GET',
      url: '/test',
      headers: {
        'accept-version': '1.0.0',
        'x-trace-id': '1234',
        authorization:
          'Bearer eywrongJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiwrongRtaW5AZXhhbXBsZS5jb20ifQ.EoDg_46Qi28tScwrong',
      },
      hostname: 'localhost',
      ip: '127.0.0.1',
      socket: { remotePort: 8080 },
    };
    const { req } = log[Symbol.for('pino.serializers')];
    const serialized = req(mockReq);
    expect(serialized).toStrictEqual({
      hostname: 'localhost',
      method: 'GET',
      remoteAddress: '127.0.0.1',
      remotePort: 8080,
      serverVersion: '1.0',
      traceId: '1234',
      url: '/test',
      version: '1.0.0',
    });
  });

  it('Redaction of secrets', () => {
    const dataForLog = {
      secret: 42,
      allowedToLog: '123',
      vclOauthClientSecret: '123',
      vnfBrokerClientSecret: '123',
      stripeWebhookEndpointSecret: '123',
      vclServiceDeskToken: '123',
    };

    log.info(dataForLog);

    expect(logStream.toString()).toMatch(
      // eslint-disable-next-line max-len
      '"secret":"...shhh...","allowedToLog":"123","vclOauthClientSecret":"...shhh...","vnfBrokerClientSecret":"...shhh...","stripeWebhookEndpointSecret":"...shhh...","vclServiceDeskToken":"...shhh..."',
    );
  });

  it('Redaction should shh credential data from verifyCredentials', () => {
    const email = 'holder@example.com';
    const jwtVc =
      'eyJhbGciOiJFUzI1NksifQ.eyJzdWIiOiJob2xkZXJAZXhhbXBsZS5jb20ifQ.c2lnbmF0dXJl';
    const contentHash = 'f0e1d2c3b4a5968778695a4b3c2d1e0f';
    const id = 'did:velocity:v2:0x1:1:1';
    const credentialData = () => ({
      id,
      credentialType: 'EmailV1.0',
      contentHash,
      credential: { id, credentialSubject: { email } },
      jwtVc,
      compact: jwtVc,
    });

    log.info({
      credentials: [credentialData(), credentialData()],
      credential: credentialData(),
    });

    const output = logStream.toString();
    expect(output).not.toContain(email);
    expect(output).not.toContain(jwtVc);
    expect(output).not.toContain(contentHash);
    const redactedCredentialData = {
      id,
      credentialType: 'EmailV1.0',
      contentHash: CENSOR,
      credential: { id, credentialSubject: CENSOR },
      jwtVc: CENSOR,
      compact: CENSOR,
    };
    expect(JSON.parse(output)).toMatchObject({
      credentials: [redactedCredentialData, redactedCredentialData],
      credential: redactedCredentialData,
    });
  });

  it('Redaction should shh key', () => {
    const dataForLog = {
      keys: [
        {
          key: 'key',
        },
      ],
      body: {
        keys: [
          {
            key: 'key',
          },
        ],
      },
    };

    log.info(dataForLog);

    expect(logStream.toString()).toMatch(
      '"keys":[{"key":"...shhh..."}],"body":{"keys":[{"key":"...shhh..."}]}',
    );
  });

  it('Redaction should shh access_token', () => {
    const dataForLog = {
      access_token: 'access_token',
      body: {
        access_token: 'access_token',
      },
    };

    log.info(dataForLog);

    expect(logStream.toString()).toMatch(
      '"access_token":"...shhh...","body":{"access_token":"...shhh..."}',
    );
  });

  it('Redaction should shh Authorization and headers.authorization', () => {
    const dataForLog = {
      Authorization: 'Authorization',
      headers: {
        Authorization: 'headers.Authorization',
        authorization: 'headers.Authorization',
      },
    };

    log.info(dataForLog);

    expect(logStream.toString()).toMatch(
      '"Authorization":"...shhh...","headers":{"Authorization":"...shhh...","authorization":"...shhh..."}',
    );
  });

  it('Redaction should shh credentials in http client request and response headers', () => {
    const dataForLog = {
      reqHeaders: {
        Authorization: 'Bearer fake-configured-token',
        authorization: 'Bearer fake-request-token',
        Cookie: 'session=fake-configured-session',
        cookie: 'session=fake-request-session',
        'user-agent': '@verii/http-client/1.0.0',
      },
      resHeaders: {
        'content-type': 'application/json',
        'set-cookie': ['session=fake-response-session'],
      },
    };

    log.info(dataForLog);

    expect(logStream.toString()).not.toContain('fake-');
    expect(JSON.parse(logStream.toString())).toMatchObject({
      reqHeaders: {
        Authorization: CENSOR,
        authorization: CENSOR,
        Cookie: CENSOR,
        cookie: CENSOR,
        'user-agent': '@verii/http-client/1.0.0',
      },
      resHeaders: {
        'content-type': 'application/json',
        'set-cookie': CENSOR,
      },
    });
  });

  it('Redaction should shh App Check request security fields', () => {
    const dataForLog = {
      headers: {
        'x-firebase-appcheck': 'app-check-token',
        'x-vcl-installation-id': 'installation-id',
      },
      body: {
        value: '+15551234567',
        verificationCode: '123456',
        account: {
          id_token: 'account-id-token',
        },
      },
    };

    log.info(dataForLog);

    expect(JSON.parse(logStream.toString())).toMatchObject({
      headers: {
        'x-firebase-appcheck': '...shhh...',
        'x-vcl-installation-id': '...shhh...',
      },
      body: {
        value: '...shhh...',
        verificationCode: '...shhh...',
        account: {
          id_token: '...shhh...',
        },
      },
    });
  });

  it('Redaction should shh vnfClientSecret', () => {
    const dataForLog = {
      vnfClientSecret: 'vnfClientSecret',
    };

    log.info(dataForLog);

    expect(logStream.toString()).toMatch('"vnfClientSecret":"...shhh..."');
  });

  it('Redaction should shh clientSecret of authClients', () => {
    const dataForLog = {
      authClients: [
        {
          clientSecret: 'clientSecret',
        },
      ],
      body: {
        authClients: [
          {
            clientSecret: 'clientSecret',
          },
        ],
      },
    };

    log.info(dataForLog);

    expect(logStream.toString()).toMatch(
      '"authClients":[{"clientSecret":"...shhh..."}],"body":{"authClients":[{"clientSecret":"...shhh..."}]}',
    );
  });

  it('Redaction should shh clientSecret of authClient', () => {
    const dataForLog = {
      authClient: {
        clientSecret: 'clientSecret',
      },
      body: {
        authClient: {
          clientSecret: 'clientSecret',
        },
      },
    };

    log.info(dataForLog);

    expect(logStream.toString()).toMatch(
      '"authClient":{"clientSecret":"...shhh..."},"body":{"authClient":{"clientSecret":"...shhh..."}}',
    );
  });

  it('Redaction of stripeSecretKey', () => {
    const dataForLog = { stripeSecretKey: 'SECRET-KEY', allowedToLog: '123' };

    log.info(dataForLog);

    expect(logStream.toString()).toMatch(
      '"stripeSecretKey":"...shhh...","allowedToLog":"123"',
    );
  });

  it('Redaction should shh token', () => {
    const dataForLog = {
      token: 'token',
      body: {
        token: 'token',
      },
    };

    log.info(dataForLog);

    expect(logStream.toString()).toMatch(
      '"token":"...shhh...","body":{"token":"...shhh..."}}',
    );
  });

  it("redacts a server's own paths as well as the shared ones", () => {
    const stream = new MemoryStream('server-redact-paths-log');
    const serverLog = loggerProvider({
      nodeEnv: 'test',
      logSeverity: 'info',
      version: '1.0',
      traceIdHeader: 'x-trace-id',
      destination: stream,
      logRedactPaths: ['body.link'],
    });

    serverLog.info({
      body: { link: 'link', token: 'token', allowedToLog: '123' },
    });

    expect(JSON.parse(stream.toString())).toMatchObject({
      body: { link: CENSOR, token: CENSOR, allowedToLog: '123' },
    });

    // Servers that don't add the path still log it.
    log.info({ body: { link: 'link' } });
    expect(logStream.toString()).toMatch('"body":{"link":"link"}');
  });

  it('Redaction should shh key.key', () => {
    const dataForLog = {
      key: {
        key: 'key',
      },
      body: {
        key: {
          key: 'key',
        },
      },
    };

    log.info(dataForLog);

    expect(logStream.toString()).toMatch(
      '"key":{"key":"...shhh..."},"body":{"key":{"key":"...shhh..."}}',
    );
  });

  it('Redaction should shh the private part of a jwk key', () => {
    const dataForLog = {
      key: { jwk: { kty: 'EC', d: 'd' } },
      keys: [{ jwk: { kty: 'EC', d: 'd' } }],
      body: {
        key: { jwk: { kty: 'EC', d: 'd' } },
        keys: [{ jwk: { kty: 'EC', d: 'd' } }],
      },
    };

    log.info(dataForLog);

    const redactedJwk = '{"jwk":{"kty":"EC","d":"...shhh..."}}';
    expect(logStream.toString()).toMatch(
      `"key":${redactedJwk},"keys":[${redactedJwk}],"body":{"key":${redactedJwk},"keys":[${redactedJwk}]}`,
    );
  });

  it('Redaction should shh the private members of transferred keys', () => {
    const transferredKey = () => ({
      kidFragment: '#key-1',
      key: 'private-hex',
      hexKey: 'private-hex',
      jwk: { kty: 'EC', crv: 'secp256k1', x: 'x', y: 'y', d: 'private-d' },
      publicJwk: { kty: 'EC', crv: 'secp256k1', x: 'x', y: 'y' },
    });
    const redactedJwk = {
      kty: 'EC',
      crv: 'secp256k1',
      x: 'x',
      y: 'y',
      d: CENSOR,
    };
    const redactedKey = {
      kidFragment: '#key-1',
      key: CENSOR,
      hexKey: CENSOR,
      jwk: redactedJwk,
      publicJwk: { kty: 'EC', crv: 'secp256k1', x: 'x', y: 'y' },
    };

    log.info({
      msg: 'transferred keys',
      jwk: transferredKey().jwk,
      keys: [transferredKey()],
      body: {
        payload: {
          create_tenant: { keys: [omit(['hexKey'], transferredKey())] },
        },
        keys: [transferredKey()],
      },
    });
    log.info({
      msg: 'added key',
      body: {
        hexKey: 'private-hex',
        jwk: transferredKey().jwk,
      },
    });

    const [transferredKeysEntry, addedKeyEntry] = logStream
      .toString()
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(transferredKeysEntry).toEqual(
      expect.objectContaining({
        jwk: redactedJwk,
        keys: [redactedKey],
        body: {
          payload: {
            create_tenant: { keys: [omit(['hexKey'], redactedKey)] },
          },
          keys: [redactedKey],
        },
      }),
    );
    expect(addedKeyEntry).toEqual(
      expect.objectContaining({
        body: { hexKey: CENSOR, jwk: redactedJwk },
      }),
    );
  });

  it('Redact single relatedResource', () => {
    const dataForLog = {
      credentials: [
        {
          relatedResource: { id: 'redact', foo: 'bar' },
        },
      ],
    };

    log.info(dataForLog);

    expect(logStream.toString()).toMatch(
      '"relatedResource":{"id":"...shhh...","foo":"bar"}',
    );
  });

  it('Redact array of relatedResource', () => {
    const dataForLog = {
      credentials: [
        {
          relatedResource: [
            { id: 'redact', foo: 'bar' },
            { id: 'redactagain' },
          ],
        },
      ],
    };

    log.info(dataForLog);

    expect(logStream.toString()).toMatch(
      '"relatedResource":[{"id":"...shhh...","foo":"bar"},{"id":"...shhh..."}]',
    );
  });

  it('Redaction should shh credentialSubject in the credentials list', () => {
    const dataForLog = {
      credentials: [
        {
          credentialSubject: {
            givenName: 'givenName',
          },
        },
      ],
    };

    log.info(dataForLog);

    expect(logStream.toString()).toMatch(
      '"credentials":[{"credentialSubject":"...shhh..."',
    );
  });

  it('Redaction should shh body.credential.credentialSubject', () => {
    const dataForLog = {
      body: {
        credential: {
          credentialSubject: {
            givenName: 'givenName',
          },
        },
      },
    };

    log.info(dataForLog);

    expect(logStream.toString()).toMatch(
      '"body":{"credential":{"credentialSubject":"...shhh..."}}',
    );
  });

  it('Redaction should shh credential.credentialSubject', () => {
    const dataForLog = {
      credential: {
        credentialSubject: {
          givenName: 'givenName',
        },
      },
    };

    log.info(dataForLog);

    expect(logStream.toString()).toMatch(
      '"credential":{"credentialSubject":"...shhh..."}',
    );
  });

  it('Redaction should shh credentialSubject in the body', () => {
    const dataForLog = {
      body: {
        credentials: [
          {
            credentialSubject: {
              givenName: 'givenName',
            },
          },
        ],
      },
    };

    log.info(dataForLog);

    expect(logStream.toString()).toMatch(
      '"body":{"credentials":[{"credentialSubject":"...shhh..."',
    );
  });

  it('Redaction should shh credentialSubject in body', () => {
    const dataForLog = {
      body: {
        credentialSubject: {
          givenName: 'givenName',
        },
      },
      credentialSubject: {
        givenName: 'givenName',
      },
    };

    log.info(dataForLog);

    expect(logStream.toString()).toMatch(
      '"body":{"credentialSubject":"...shhh..."},"credentialSubject":"...shhh..."}',
    );
  });

  it('Redaction should shh credentialSubject in the body[]', () => {
    const dataForLog = {
      body: [
        {
          credentialSubject: {
            givenName: 'givenName',
          },
        },
      ],
    };

    log.info(dataForLog);

    expect(logStream.toString()).toMatch(
      '"body":[{"credentialSubject":"...shhh..."}]',
    );
  });

  it('Redaction should shh credentialSubject in the credentialEntries[]', () => {
    const dataForLog = {
      credentialEntries: [
        {
          credential: {
            credentialSubject: {
              givenName: 'givenName',
            },
          },
        },
      ],
    };

    log.info(dataForLog);

    expect(logStream.toString()).toMatch(
      '"credentialEntries":[{"credential":{"credentialSubject":"...shhh..."}}]',
    );
  });

  it('Redaction should shh credentialSubject in the emailCredentials[]', () => {
    const dataForLog = {
      body: {
        emailCredentials: [
          {
            credentialSubject: {
              givenName: 'givenName',
            },
          },
        ],
      },
    };

    log.info(dataForLog);

    expect(logStream.toString()).toMatch(
      '"body":{"emailCredentials":[{"credentialSubject":"...shhh..."}]}',
    );
  });

  it('Redaction should shh credentialSubject in the idDocumentCredentials[]', () => {
    const dataForLog = {
      body: {
        idDocumentCredentials: [
          {
            credentialSubject: {
              foo: 'foo',
            },
          },
        ],
      },
    };

    log.info(dataForLog);

    expect(logStream.toString()).toMatch(
      '"body":{"idDocumentCredentials":[{"credentialSubject":"...shhh..."}]}',
    );
  });

  it('Redaction should shh credentialSubject in the phoneCredentials[]', () => {
    const dataForLog = {
      body: {
        phoneCredentials: [
          {
            credentialSubject: {
              foo: 'foo',
            },
          },
        ],
        phones: ['foo'],
      },
    };

    log.info(dataForLog);

    expect(logStream.toString()).toMatch(
      '"body":{"phoneCredentials":[{"credentialSubject":"...shhh..."}],"phones":["...shhh..."]}',
    );
  });

  it('Redaction should shh credentialSubject in the emailCredentials[]', () => {
    const dataForLog = {
      body: {
        emailCredentials: [
          {
            credentialSubject: {
              givenName: 'givenName',
            },
          },
        ],
        emails: ['foo'],
      },
    };

    log.info(dataForLog);

    expect(logStream.toString()).toMatch(
      '"body":{"emailCredentials":[{"credentialSubject":"...shhh..."}],"emails":["...shhh..."]}',
    );
  });

  it('Redaction should shh credentialSubject in the issuedCredentials[]', () => {
    const dataForLog = {
      body: {
        issuedCredentials: [
          {
            credentialSubject: {
              givenName: 'givenName',
            },
          },
        ],
      },
    };

    log.info(dataForLog);

    expect(logStream.toString()).toMatch(
      '"body":{"issuedCredentials":[{"credentialSubject":"...shhh..."}]}',
    );
  });

  it('Redaction should shh refresh and access tokens', () => {
    const dataForLog = {
      body: {
        account: {
          refreshToken: 'refresh_token',
        },
        access_token: 'access_token',
        refresh_token: 'refresh_token',
      },
    };

    log.info(dataForLog);

    const logInfo =
      '"body":{"account":{"refreshToken":"...shhh..."},"access_token":"...shhh...","refresh_token":"...shhh..."}';

    expect(logStream.toString()).toMatch(logInfo);
  });

  it('Redaction should redact body.file', () => {
    const dataForLog = {
      body: {
        file: 'LARGE-FILE-CONTENT',
      },
    };

    log.info(dataForLog);

    const logInfo = '"body":{"file":"...large file..."}';

    expect(logStream.toString()).toMatch(logInfo);
  });

  it('Redaction should redact body.file', () => {
    const dataForLog = {
      body: {
        file: 'LARGE-FILE-CONTENT',
      },
    };

    log.info(dataForLog);

    const logInfo = '"body":{"file":"...large file..."}';

    expect(logStream.toString()).toMatch(logInfo);
  });

  it('redacts operator credentials in debug logs for dev', () => {
    const stream = new MemoryStream('dev-debug-log');
    const debugLog = loggerProvider({
      nodeEnv: 'dev',
      logSeverity: 'debug',
      version: '1.0',
      traceIdHeader: 'x-trace-id',
      destination: stream,
    });

    debugLog.debug(sensitiveDataForLog());

    expectSensitiveDataToBeRedacted(stream.toString());
  });

  it('redacts operator credentials in debug logs for development', () => {
    const stream = new MemoryStream('development-debug-log');
    const debugLog = loggerProvider({
      nodeEnv: 'development',
      logSeverity: 'debug',
      version: '1.0',
      traceIdHeader: 'x-trace-id',
      destination: stream,
    });

    debugLog.debug(sensitiveDataForLog());

    expectSensitiveDataToBeRedacted(stream.toString());
  });

  it('redacts credential payloads in development debug logs', () => {
    const stream = new MemoryStream('development-debug-credential-log');
    const debugLog = loggerProvider({
      nodeEnv: 'development',
      logSeverity: 'debug',
      version: '1.0',
      traceIdHeader: 'x-trace-id',
      destination: stream,
    });

    debugLog.debug({
      credentialSubject: { givenName: 'Ada' },
      relatedResource: { id: 'https://example.com/private-resource' },
    });

    expect(JSON.parse(stream.toString())).toMatchObject({
      credentialSubject: CENSOR,
      relatedResource: { id: CENSOR },
    });
  });

  it('redacts additional operator credentials in debug logs for dev', () => {
    const stream = new MemoryStream('additional-dev-debug-log');
    const debugLog = loggerProvider({
      nodeEnv: 'dev',
      logSeverity: 'debug',
      version: '1.0',
      traceIdHeader: 'x-trace-id',
      destination: stream,
    });

    debugLog.debug(additionalSensitiveDataForLog());

    expectAdditionalSensitiveDataToBeRedacted(stream.toString());
  });

  it('redacts additional operator credentials in debug logs for development', () => {
    const stream = new MemoryStream('additional-development-debug-log');
    const debugLog = loggerProvider({
      nodeEnv: 'development',
      logSeverity: 'debug',
      version: '1.0',
      traceIdHeader: 'x-trace-id',
      destination: stream,
    });

    debugLog.debug(additionalSensitiveDataForLog());

    expectAdditionalSensitiveDataToBeRedacted(stream.toString());
  });
});

describe('Request url censoring', () => {
  const logStream = new MemoryStream('request-url');
  const log = loggerProvider({
    nodeEnv: 'test',
    logSeverity: 'info',
    version: '1.0',
    traceIdHeader: 'x-trace-id',
    destination: logStream,
  });
  const { req: serializeReq } = log[Symbol.for('pino.serializers')];
  const serializeUrl = (url) =>
    serializeReq({
      method: 'GET',
      url,
      headers: {},
      hostname: 'localhost',
      ip: '127.0.0.1',
      socket: { remotePort: 8080 },
    }).url;

  const queryParams = [
    'access_token',
    'authCode',
    'credential_offer',
    'credential_offer_uri',
    'deeplink',
    'openid4vc_uri',
    'pre-authorized_code',
    'push_delegate.push_token',
    'request_uri',
    'vendorOriginContext',
  ];

  const cases = [
    ...queryParams.map((name) => ({
      name: `the ${name} query parameter`,
      url: `/path?${name}=fixture&state=abc`,
      expected: `/path?${name}=${CENSOR}&state=abc`,
    })),
    {
      name: 'an access token whose value holds a bracket before an equals sign',
      url: 'https://example.test/path?access_token=fake-token[]=suffix&state=abc',
      expected: `https://example.test/path?access_token=${CENSOR}&state=abc`,
    },
    {
      name: 'an access token in an OAuth implicit-flow fragment',
      url: '/path#access_token=fake-token&token_type=bearer',
      expected: `/path#access_token=${CENSOR}&token_type=bearer`,
    },
    {
      name: 'a bracketed push token',
      url: '/path?push_delegate[push_token]=x&other=1',
      expected: `/path?push_delegate[push_token]=${CENSOR}&other=1`,
    },
    {
      name: 'an indexed push token with semicolons in the path and parameter name',
      url: '/missing;v=1?push_delegate[0];[push_token]=fixture-token',
      expected: `/missing;v=1?push_delegate[0];[push_token]=${CENSOR}`,
    },
    {
      name: 'a bracketed push token with an encoded name',
      url: '/path?push_delegate%5Bpush_token%5D=x&other=1',
      expected: `/path?push_delegate%5Bpush_token%5D=${CENSOR}&other=1`,
    },
    {
      name: 'a push token with an encoded underscore in the name',
      url: '/path?push%5Fdelegate.push_token=x&other=1',
      expected: `/path?push%5Fdelegate.push_token=${CENSOR}&other=1`,
    },
    {
      name: 'a push token with an encoded dot in the name',
      url: '/path?push_delegate%2Epush_token=x',
      expected: `/path?push_delegate%2Epush_token=${CENSOR}`,
    },
    {
      name: 'repeated authCode array parameters alongside an unlisted array',
      url: '/org/did:web:a/get-credential-manifest?authCode[]=x&other[]=keep&authCode[]=y',
      expected: `/org/did:web:a/get-credential-manifest?authCode[]=${CENSOR}&other[]=keep&authCode[]=${CENSOR}`,
    },
    {
      name: 'an indexed authCode',
      url: '/path?authCode[0]=x',
      expected: `/path?authCode[0]=${CENSOR}`,
    },
    {
      name: 'an authCode array with an encoded name',
      url: '/path?authCode%5B%5D=x',
      expected: `/path?authCode%5B%5D=${CENSOR}`,
    },
    {
      name: 'a bracketed push token array',
      url: '/path?push_delegate[push_token][]=x',
      expected: `/path?push_delegate[push_token][]=${CENSOR}`,
    },
    {
      name: 'a parameter with no value',
      url: '/path?authCode&state=abc',
      expected: `/path?authCode=${CENSOR}&state=abc`,
    },
    {
      name: 'repeated parameters',
      url: '/path?authCode=x&a=1&authCode=y&push_delegate.push_token=z&a=2',
      expected: `/path?authCode=${CENSOR}&a=1&authCode=${CENSOR}&push_delegate.push_token=${CENSOR}&a=2`,
    },
    {
      name: 'a value that contains an equals sign',
      url: '/path?authCode=a=b&state=abc',
      expected: `/path?authCode=${CENSOR}&state=abc`,
    },
    {
      name: 'a name with a malformed escape',
      url: '/path?authCode=x&%E0%A4%A=1',
      expected: `/path?authCode=${CENSOR}&%E0%A4%A=1`,
    },
    {
      name: 'a url with no query string',
      url: '/org/did:web:a/get-credential-manifest',
      expected: '/org/did:web:a/get-credential-manifest',
    },
    {
      name: 'a semicolon in the path followed by a listed name',
      url: '/path;authCode=x',
      expected: '/path;authCode=x',
    },
    {
      name: 'a url with an empty query string',
      url: '/path?',
      expected: '/path?',
    },
    {
      name: 'only unlisted parameters',
      url: '/path?credential_types=Test&push_delegate.push_url=https%3A%2F%2Fa.example&id=1',
      expected:
        '/path?credential_types=Test&push_delegate.push_url=https%3A%2F%2Fa.example&id=1',
    },
    {
      name: 'a listed name that only appears inside a value',
      url: '/path?note=authCode&redirect=push_delegate.push_token',
      expected: '/path?note=authCode&redirect=push_delegate.push_token',
    },
    {
      name: 'a name that only starts with a listed name',
      url: '/path?authCodes=x&push_delegate.push_tokens=y',
      expected: '/path?authCodes=x&push_delegate.push_tokens=y',
    },
    {
      name: 'a bracketed push token followed by other text, which the parser drops',
      url: '/path?push_delegate[push_token]suffix=x&other=1',
      expected: `/path?push_delegate[push_token]suffix=${CENSOR}&other=1`,
    },
    {
      name: 'a value nested under a bracketed push token',
      url: '/path?push_delegate[push_token][x]=x',
      expected: `/path?push_delegate[push_token][x]=${CENSOR}`,
    },
    {
      name: 'a value nested under a dotted push token',
      url: '/path?push_delegate.push_token.extra=x',
      expected: `/path?push_delegate.push_token.extra=${CENSOR}`,
    },
    {
      name: 'a value nested under an authCode with an unclosed bracket',
      url: '/path?authCode[=x',
      expected: `/path?authCode[=${CENSOR}`,
    },
    {
      name: 'a bracketed authCode with no parent',
      url: '/path?[authCode]=x',
      expected: `/path?[authCode]=${CENSOR}`,
    },
    {
      name: 'a comma separated authCode',
      url: '/path?authCode=x,y',
      expected: `/path?authCode=${CENSOR}`,
    },
    {
      name: 'a name the parser reads as another parameter',
      url: '/path?authCode]=x&push_delegate[push_token=y',
      expected: '/path?authCode]=x&push_delegate[push_token=y',
    },
    {
      name: 'a parent of a listed path',
      url: '/path?push_delegate=x',
      expected: '/path?push_delegate=x',
    },
    {
      name: 'an encoded deep link and credential offer',
      url: `/app-redirect?deeplink=${encodeURIComponent(
        'velocity-network://issue?vendorOriginContext=depot%3Ad%3Afixture-code',
      )}&openid4vc_uri=${encodeURIComponent(
        'openid-credential-offer://?credential_offer=fixture-code',
      )}`,
      expected: `/app-redirect?deeplink=${CENSOR}&openid4vc_uri=${CENSOR}`,
    },
    {
      name: 'an unencoded deep link, whose inner parameters are censored too',
      url: '/app-redirect?deeplink=velocity-network://issue?request_uri=https://a.example/r&vendorOriginContext=depot:d:fixture-code',
      expected: `/app-redirect?deeplink=${CENSOR}&vendorOriginContext=${CENSOR}`,
    },
    {
      name: 'a query string that starts with a fragment',
      url: '/path#authCode=x&state=abc',
      expected: `/path#authCode=${CENSOR}&state=abc`,
    },
    {
      name: 'a listed parameter after a fragment',
      url: '/path?state=abc#authCode=x&other=1',
      expected: `/path?state=abc#authCode=${CENSOR}&other=1`,
    },
    {
      name: 'a listed parameter after a question mark inside a fragment',
      url: '/path#frag?authCode=x',
      expected: `/path#frag?authCode=${CENSOR}`,
    },
    {
      name: 'a listed parameter inside an unencoded url value',
      url: '/path?redirect=https://a.example/cb?authCode=x&state=abc',
      expected: `/path?redirect=https://a.example/cb?authCode=${CENSOR}&state=abc`,
    },
    {
      name: 'a listed parameter inside an encoded url value',
      url: '/path?redirect=https%3A%2F%2Fexample.test%2Fcb%3FauthCode%3Dx',
      expected: `/path?redirect=${CENSOR}`,
    },
    {
      name: 'a listed parameter inside a twice-encoded url value',
      url: '/path?redirect=https%253A%252F%252Fexample.test%252Fcb%253FauthCode%253Dx',
      expected: `/path?redirect=${CENSOR}`,
    },
    {
      name: 'an encoded url value with only unlisted parameters',
      url: '/path?redirect=https%3A%2F%2Fexample.test%2Fcb%3Fstate%3Dabc%26next%3Dhome',
      expected:
        '/path?redirect=https%3A%2F%2Fexample.test%2Fcb%3Fstate%3Dabc%26next%3Dhome',
    },
    {
      name: 'a value with a malformed escape',
      url: '/path?redirect=%E0%A4%A',
      expected: '/path?redirect=%E0%A4%A',
    },
    {
      name: 'a value still encoded after five decoding passes',
      url: '/path?redirect=%25252525252F',
      expected: `/path?redirect=${CENSOR}`,
    },
    {
      name: 'a listed value that holds a fragment',
      url: '/path?authCode=x#y&state=abc',
      expected: `/path?authCode=${CENSOR}&state=abc`,
    },
    {
      name: 'an unlisted fragment',
      url: '/path?state=abc#section',
      expected: '/path?state=abc#section',
    },
  ];

  for (const { name, url, expected } of cases) {
    it(`serializes ${name}`, () => {
      expect(serializeUrl(url)).toEqual(expected);
    });
  }

  it('leaves a request without a url as it is', () => {
    expect(serializeUrl(undefined)).toBeUndefined();
  });
});

describe('Security paths', () => {
  const paths = [
    'Authorization',
    'accessToken',
    'access_token',
    'bearerToken',
    'body.authorization_code',
    'body.tx_code',
    'body.vp_token',
    'body["pre-authorized_code"]',
    'context.config',
    'encryptedPK',
    'event.meta.headers',
    'headers.Authorization',
    'headers.Cookie',
    'headers.authorization',
    'headers.cookie',
    'headers.referer',
    'id_token',
    'jwk.d',
    'keyEncryptionSecret',
    'keys[*].jwk.d',
    'keys[*].key',
    'meta.headers',
    'privateKey',
    'refresh_token',
    'secret',
    'token',
  ].map((path) => path.replaceAll('[*]', '[0]'));
  const sample = 'fixture-value-to-censor';
  const payload = paths.reduce((obj, path) => set(path, sample, obj), {});
  const censored = Object.fromEntries(paths.map((path) => [path, CENSOR]));
  const environments = [
    'production',
    'staging',
    'qa',
    'dev',
    'development',
    'test',
    undefined,
  ];
  const configurations = environments.flatMap((nodeEnv) =>
    Object.keys(pino.levels.values).map((logSeverity) => ({
      nodeEnv,
      logSeverity,
    })),
  );

  for (const { nodeEnv, logSeverity } of configurations) {
    it(`censors security paths with nodeEnv=${nodeEnv} and level=${logSeverity}`, () => {
      const stream = new MemoryStream('security-paths');
      const log = loggerProvider({ nodeEnv, logSeverity, destination: stream });

      log[logSeverity](payload);
      log.child(payload)[logSeverity]('Child log');

      const output = stream.toString().trim();
      const valuesByLog = output.split('\n').map((line) => {
        const entry = JSON.parse(line);
        return Object.fromEntries(
          paths.map((path) => [path, get(path, entry)]),
        );
      });
      expect(valuesByLog).toEqual([censored, censored]);
      expect(output).not.toContain(sample);
    });
  }
});

describe('Hub client redaction paths', () => {
  const paths = [
    'body.openidCredentialOffer',
    'body.preauthCode',
    'body.redirectUrl',
    'body.vnProtocolLink',
  ];

  for (const path of paths) {
    it(`censors ${path}`, () => {
      const stream = new MemoryStream('hub-client-paths');
      const log = loggerProvider({
        logSeverity: 'info',
        logRedactPaths: HUB_CLIENT_REDACT_PATHS,
        destination: stream,
      });

      log.info(set(path, 'fixture-value-to-censor', {}));

      expect(get(path, JSON.parse(stream.toString()))).toBe(CENSOR);
    });
  }
});
