#!/usr/bin/env node
const console = require('console');

const stdin = process.openStdin();

let data = '';

stdin.on('data', (chunk) => {
  // eslint-disable-next-line better-mutation/no-mutation
  data += chunk;
});

stdin.on('end', () => {
  const licenses = JSON.parse(data);
  const normalizedLicenses = normalizeLicenses(licenses);

  processBadLicenses(
    normalizedLicenses.head,
    getBadLicenses(normalizedLicenses.entries),
  );
});

const validLicenseRegex =
  /MIT|MIT OR X11|BSD|ISC|Apache 2.0|Apache-2.0|Unlicense|Public Domain|CC-BY-3.0|CC-BY-4.0|ODC-By-1.0|CC0-1.0|WTFPL|Python-2.0|BlueOak-1.0.0/;

const normalizeLicenses = (licenses) => {
  if (licenses?.data?.head && Array.isArray(licenses.data.body)) {
    const nameIndex = licenses.data.head.findIndex((x) => x === 'Name');
    const licenseIndex = licenses.data.head.findIndex((x) => x === 'License');

    return {
      head: licenses.data.head,
      entries: licenses.data.body.map((row) => ({
        name: row[nameIndex],
        license: row[licenseIndex],
        row,
      })),
    };
  }

  return {
    head: ['Name', 'License', 'Versions'],
    entries: Object.entries(licenses).flatMap(([license, packages]) => {
      if (!Array.isArray(packages)) {
        return [];
      }

      return packages.map((pkg) => ({
        ...pkg,
        license: pkg.license || license,
      }));
    }),
  };
};

const getBadLicenses = (entries) => {
  const nameLicenseExceptionsMap = {};
  console.log({ 'Ignored Licenses': nameLicenseExceptionsMap });

  return entries.filter((entry) => {
    return (
      !nameLicenseExceptionsMap[entry.name]?.includes(entry.license) &&
      !validLicenseRegex.test(entry.license)
    );
  });
};

const processBadLicenses = (head, badLicenses) => {
  if (badLicenses.length === 0) {
    console.info('Licenses OK');
    return;
  }

  console.error('Error: Bad licenses detected');
  console.dir(head);
  console.dir(badLicenses);
  process.exit(1);
};
