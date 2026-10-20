const nockModule = require('nock');

const nock = nockModule.default ?? nockModule;

// Unmocked requests fail with NetConnectNotAllowedError instead of reaching the network.
// Only local infrastructure (e.g. localstack, the blockchain RPC node) stays reachable; nock matches against "host:port".
nock.disableNetConnect();
nock.enableNetConnect(/^(localhost|127\.0\.0\.1):\d+$/);

module.exports = nock;
