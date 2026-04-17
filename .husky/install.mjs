const isEnabledEnvFlag = (value) =>
  value === '1' || value?.toLowerCase() === 'true';

const omitIncludesDevDependency = (value) =>
  value
    ?.split(',')
    .map((entry) => entry.trim())
    .includes('dev') ?? false;

const shouldSkipInstall = () =>
  process.env.NODE_ENV === 'production' ||
  isEnabledEnvFlag(process.env.CI) ||
  isEnabledEnvFlag(process.env.IS_CI) ||
  isEnabledEnvFlag(process.env.npm_config_production) ||
  omitIncludesDevDependency(process.env.npm_config_omit);

const main = async () => {
  if (shouldSkipInstall()) {
    process.exit(0);
  }

  try {
    // Husky is intentionally a devDependency; this wrapper skips importing it in CI/production.
    // eslint-disable-next-line import/no-extraneous-dependencies
    const husky = (await import('husky')).default;

    process.stdout.write(`${husky()}\n`);
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND') {
      process.exit(0);
    }

    throw error;
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
