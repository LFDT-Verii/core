const main = async () => {
  if (
    process.env.NODE_ENV === 'production' ||
    process.env.CI ||
    process.env.IS_CI
  ) {
    process.exit(0);
  }

  // Husky is intentionally a devDependency; this wrapper skips importing it in CI/production.
  // eslint-disable-next-line import/no-extraneous-dependencies
  const husky = (await import('husky')).default;

  process.stdout.write(`${husky()}\n`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
