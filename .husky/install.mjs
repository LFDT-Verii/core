const main = async () => {
  try {
    // Husky is intentionally a devDependency; skip install when it is absent.
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
