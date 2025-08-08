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
const { after, afterEach, describe, it } = require('node:test');
const { expect } = require('expect');

const path = require('path');
const fs = require('fs');
const got = require('got');
const h2url = require('h2url');
const { wait } = require('@verii/common-functions');
const { loadTestEnv, buildMongoConnection } = require('@verii/tests-helpers');

loadTestEnv();
const { genericConfig } = require('@verii/config');
const { createServer, listenServer } = require('../src/create-server');

const mongoConnection = buildMongoConnection('credentialagent');
const appHost = 'localhost';
const appPort = 3000;
const buildConfig = () => {
  return {
    ...genericConfig,
    appPort,
    appHost,
    mongoConnection,
  };
};

const initServer = (server) => {
  server.get('/', async (req, reply) => {
    return reply
      .status(200)
      .send(
        `Welcome to Test Host: ${server.config.appHost}:${server.config.appPort}\n`
      );
  });
  return server;
};
describe(
  'HTTP/2 or 1.1 and HTTP or HTTPS configuration',
  { timeout: 15000 },
  () => {
    let server;

    afterEach(async () => {
      if (server) {
        await server.close();
      }
    });
    after(async () => {});

    it('server should respond to HTTP/1.1 insecure by default', async () => {
      const config = buildConfig();
      server = initServer(createServer(config));
      listenServer(server);
      await server.ready();

      const urlObj = new URL(`http://${appHost}:${appPort}`);
      const response = await got(urlObj.href);
      expect(response.statusCode).toEqual(200);
    });

    it('server should respond to HTTP/1.1 secure when ssl termination is configured', async () => {
      const serverCertificateFilePath = path.join(__dirname, 'localhost.cert');
      const serverCertificate = fs.readFileSync(serverCertificateFilePath);
      const serverCertificateKeyFilePath = path.join(
        __dirname,
        'localhost.key'
      );
      const serverCertificateKey = fs.readFileSync(
        serverCertificateKeyFilePath
      );
      const config = buildConfig();
      config.serverCertificateKey = serverCertificateKey;
      config.serverCertificate = serverCertificate;
      server = initServer(createServer(config));

      listenServer(server);
      await server.ready();
      const urlObj = new URL(`http://${appHost}:${appPort}`);
      urlObj.protocol = 'https';
      const response = await got(urlObj.href, {
        https: {
          certificateAuthority: serverCertificate,
        },
      });
      expect(response.statusCode).toEqual(200);
    });

    it('server should respond to HTTP/2 insecure when http2 mode is enabled', async () => {
      const config = buildConfig();
      config.enableHttp2 = true;

      server = initServer(createServer(config));
      listenServer(server);
      await server.ready();
      const urlObj = new URL(`http://${appHost}:${appPort}`);
      await wait(3000);
      const response = await h2url.concat({ url: urlObj.href });
      expect(response.headers[':status']).toEqual(200);
    });

    it('server should respond to HTTP/2 secure when http2 mode is enabled and ssl termination is configured', async () => {
      const serverCertificateFilePath = path.join(__dirname, 'localhost.cert');
      const serverCertificate = fs.readFileSync(serverCertificateFilePath);
      const serverCertificateKeyFilePath = path.join(
        __dirname,
        'localhost.key'
      );
      const serverCertificateKey = fs.readFileSync(
        serverCertificateKeyFilePath
      );

      const config = buildConfig();
      config.serverCertificateKey = serverCertificateKey;
      config.serverCertificate = serverCertificate;
      config.enableHttp2 = true;

      server = initServer(createServer(config));
      listenServer(server);
      await server.ready();
      await wait(3000);
      const urlObj = new URL(`http://${appHost}:${appPort}`);
      urlObj.protocol = 'https';
      const response = await h2url.concat({ url: urlObj.href });
      expect(response.headers[':status']).toEqual(200);
    });

    it('server should respond to HTTP/1 secure when http2 mode is enabled and ssl termination is configured', async () => {
      const serverCertificateFilePath = path.join(__dirname, 'localhost.cert');
      const serverCertificate = fs.readFileSync(serverCertificateFilePath);
      const serverCertificateKeyFilePath = path.join(
        __dirname,
        'localhost.key'
      );
      const serverCertificateKey = fs.readFileSync(
        serverCertificateKeyFilePath
      );

      const config = buildConfig();
      config.serverCertificateKey = serverCertificateKey;
      config.serverCertificate = serverCertificate;
      config.enableHttp2 = true;

      server = initServer(createServer(config));
      listenServer(server);
      await server.ready();
      const urlObj = new URL(`http://${appHost}:${appPort}`);
      urlObj.protocol = 'https';
      await wait(3000);
      const response = await got(urlObj.href, {
        https: {
          certificateAuthority: serverCertificate,
        },
      });
      expect(response.statusCode).toEqual(200);
    });
  }
);
