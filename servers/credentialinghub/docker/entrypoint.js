const { resolveRuntimeEnvironment } = require('./resolve-runtime-environment');

try {
  // eslint-disable-next-line better-mutation/no-mutating-functions
  Object.assign(
    process.env,
    resolveRuntimeEnvironment({
      args: process.argv.slice(2),
      env: process.env,
    }),
  );
  require('../src/main');
} catch (error) {
  console.error(
    `Credentialing Hub startup configuration error: ${error.message}`,
  );
  // eslint-disable-next-line better-mutation/no-mutation
  process.exitCode = 64;
}
