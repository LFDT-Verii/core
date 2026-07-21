const { once } = require('node:events');
const { createServer } = require('node:http');
const { spawn } = require('node:child_process');
const { after, before, describe, it } = require('node:test');
const { expect } = require('expect');

const reservePort = async () => {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise((resolve) => {
    server.close(resolve);
  });
  return port;
};

const delay = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 50);
  });

const waitForHealth = async (baseUrl, attemptsRemaining = 50) => {
  try {
    const response = await fetch(`${baseUrl}/health`);
    if (response.ok) {
      return undefined;
    }
  } catch {
    // The child process has not started listening yet.
  }
  if (attemptsRemaining <= 1) {
    throw new Error('Local dependency simulator did not become healthy.');
  }
  await delay();
  await waitForHealth(baseUrl, attemptsRemaining - 1);
  return undefined;
};

describe('local dependency simulator', () => {
  let baseUrl;
  let child;

  before(async () => {
    const port = await reservePort();
    baseUrl = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, ['local/mock-dependencies.mjs'], {
      cwd: __dirname.replace(/\/test$/, ''),
      env: { ...process.env, PORT: String(port), PUBLIC_URL: baseUrl },
      stdio: 'ignore',
    });
    await waitForHealth(baseUrl);
  });

  after(async () => {
    if (!child.killed) {
      child.kill('SIGTERM');
      await once(child, 'exit');
    }
  });

  it('does not reflect wallet redirect query values into executable HTML', async () => {
    const maliciousDepotId = "</script><script>throw new Error('xss')</script>";
    const response = await fetch(
      `${baseUrl}/app-redirect?depotId=${encodeURIComponent(maliciousDepotId)}&phase=issue`,
    );
    const body = await response.text();

    expect(response.status).toEqual(200);
    expect(body).not.toContain(maliciousDepotId);
  });
});
