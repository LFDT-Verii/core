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
  processBadLicenses(licenses.data.head, getBadLicenses(licenses));
});

const validLicenseRegex =
  /MIT|MIT OR X11|BSD|ISC|Apache 2.0|Apache-2.0|Unlicense|Public Domain|CC-BY-3.0|CC-BY-4.0|ODC-By-1.0|CC0-1.0|WTFPL|Python-2.0|BlueOak-1.0.0/;

const getBadLicenses = (licenses) => {
  const nameLicenseExceptionsMap = {};
  console.log({ 'Ignored Licenses': nameLicenseExceptionsMap });
  const nameIndex = licenses.data.head.findIndex((x) => x === 'Name');
  const licenseIndex = licenses.data.head.findIndex((x) => x === 'License');
  return licenses.data.body.filter((row) => {
    return (
      !nameLicenseExceptionsMap[row[nameIndex]]?.includes(row[licenseIndex]) &&
      !validLicenseRegex.test(row[licenseIndex])
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
