// Preloaded (--require) by the package test scripts so that every test file runs with the nock network guard,
// including files that never import nock. The runner's parent process only spawns the per-file test
// processes (which have NODE_TEST_CONTEXT set), so it is skipped there.
if (process.env.NODE_TEST_CONTEXT != null) {
  require('./nock');
}
