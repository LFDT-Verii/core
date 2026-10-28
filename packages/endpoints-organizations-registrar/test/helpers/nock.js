const { after, afterEach } = require('node:test');
const nockModule = require('nock');

const nock = nockModule.default ?? nockModule;

// Only local infrastructure (e.g. localstack, the blockchain RPC node) is reachable; nock matches against "host:port".
const LOCAL_HOST = /^(localhost|127\.0\.0\.1):\d+$/;

const unmockedRequests = [];

const toHostPort = (url) =>
  `${url.hostname}:${url.port || (url.protocol === 'http:' ? '80' : '443')}`;

const recordUnmockedRequest = (request) => {
  const url = new URL(request.url);
  if (!LOCAL_HOST.test(toHostPort(url))) {
    unmockedRequests.push(`${request.method} ${url.href}`);
  }
};

const assertNoUnmockedRequests = () => {
  const requests = unmockedRequests.splice(0);
  if (requests.length > 0) {
    throw new Error(
      `Unmocked HTTP request(s) to non-local hosts: ${requests.join(', ')}. Mock them with nock.`,
    );
  }
};

// Unmocked requests fail with NetConnectNotAllowedError instead of reaching the network, and nock answers
// requests that match no interceptor with a 501. The app often swallows both (did:web resolution maps them
// to the expected 4xx, monitoring is best-effort), so the hooks below fail the test that made them.
nock.disableNetConnect();
nock.enableNetConnect(LOCAL_HOST);
nock.emitter.on('no match', recordUnmockedRequest);

afterEach(assertNoUnmockedRequests);
after(assertNoUnmockedRequests);

module.exports = nock;
