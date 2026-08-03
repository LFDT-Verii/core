const { resolveRuntimeEnvironment } = require('./resolve-runtime-environment');

const resolveStartupEnvironment = () => {
  try {
    return resolveRuntimeEnvironment({
      args: process.argv.slice(2),
      env: process.env,
    });
  } catch (error) {
    console.error(
      `Credentialing Hub startup configuration error: ${error.message}`,
    );
    // eslint-disable-next-line better-mutation/no-mutation
    process.exitCode = 64;
    return null;
  }
};

const startupEnvironment = resolveStartupEnvironment();
if (startupEnvironment != null) {
  // eslint-disable-next-line better-mutation/no-mutating-functions
  Object.assign(process.env, startupEnvironment);
  require('../src/main');
}
