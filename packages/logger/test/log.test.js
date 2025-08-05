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
const { Writable } = require('node:stream');

const { beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');

const { loggerProvider } = require('../index');

const store = {};
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
          // eslint-disable-next-line max-len
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
      '"secret":"...shhh...","allowedToLog":"123","vclOauthClientSecret":"...shhh...","vnfBrokerClientSecret":"...shhh...","stripeWebhookEndpointSecret":"...shhh...","vclServiceDeskToken":"...shhh..."'
    );
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
      '"keys":[{"key":"...shhh..."}],"body":{"keys":[{"key":"...shhh..."}]}'
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
      '"access_token":"...shhh...","body":{"access_token":"...shhh..."}'
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
      '"Authorization":"...shhh...","headers":{"Authorization":"...shhh...","authorization":"...shhh..."}'
    );
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
      '"authClients":[{"clientSecret":"...shhh..."}],"body":{"authClients":[{"clientSecret":"...shhh..."}]}'
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
      // eslint-disable-next-line max-len
      '"authClient":{"clientSecret":"...shhh..."},"body":{"authClient":{"clientSecret":"...shhh..."}}'
    );
  });

  it('Redaction of stripeSecretKey', () => {
    const dataForLog = { stripeSecretKey: 'SECRET-KEY', allowedToLog: '123' };

    log.info(dataForLog);

    expect(logStream.toString()).toMatch(
      '"stripeSecretKey":"...shhh...","allowedToLog":"123"'
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
      '"token":"...shhh...","body":{"token":"...shhh..."}}'
    );
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
      '"key":{"key":"...shhh..."},"body":{"key":{"key":"...shhh..."}}'
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
      '"relatedResource":{"id":"...shhh...","foo":"bar"}'
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
      '"relatedResource":[{"id":"...shhh...","foo":"bar"},{"id":"...shhh..."}]'
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
      '"credentials":[{"credentialSubject":"...shhh..."'
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
      '"body":{"credential":{"credentialSubject":"...shhh..."}}'
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
      '"credential":{"credentialSubject":"...shhh..."}'
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
      '"body":{"credentials":[{"credentialSubject":"...shhh..."'
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
      // eslint-disable-next-line max-len
      '"body":{"credentialSubject":"...shhh..."},"credentialSubject":"...shhh..."}'
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
      '"body":[{"credentialSubject":"...shhh..."}]'
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
      '"credentialEntries":[{"credential":{"credentialSubject":"...shhh..."}}]'
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
      '"body":{"emailCredentials":[{"credentialSubject":"...shhh..."}]}'
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
      '"body":{"idDocumentCredentials":[{"credentialSubject":"...shhh..."}]}'
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
      '"body":{"phoneCredentials":[{"credentialSubject":"...shhh..."}],"phones":["...shhh..."]}'
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
      '"body":{"emailCredentials":[{"credentialSubject":"...shhh..."}],"emails":["...shhh..."]}'
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
      '"body":{"issuedCredentials":[{"credentialSubject":"...shhh..."}]}'
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

    const logInfo =
      // eslint-disable-next-line max-len
      '"body":{"file":"...large file..."}';

    expect(logStream.toString()).toMatch(logInfo);
  });

  it('Redaction should redact body.file', () => {
    const dataForLog = {
      body: {
        file: 'LARGE-FILE-CONTENT',
      },
    };

    log.info(dataForLog);

    const logInfo =
      // eslint-disable-next-line max-len
      '"body":{"file":"...large file..."}';

    expect(logStream.toString()).toMatch(logInfo);
  });

  it('Redaction should redact err.gatewayResponse', () => {
    const dataForLog = {
      err: {
        gatewayResponse: {
          field: 'large-object',
        },
      },
    };

    log.info(dataForLog);

    const logInfo =
      // eslint-disable-next-line max-len
      '"err":{"gatewayResponse":"...large object..."}';

    expect(logStream.toString()).toMatch(logInfo);
  });
});
