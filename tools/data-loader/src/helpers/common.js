const console = require('console');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

const writeFile = (filePath, fileContent) => {
  const fileBasename = path.basename(filePath, '.*');

  console.info(`${chalk.green('Writing:')} ${chalk.whiteBright(fileBasename)}`);

  fs.writeFileSync(filePath, fileContent, 'utf8');
};

const readFile = (filePath, missingError) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(missingError);
  }

  return fs.readFileSync(filePath, 'utf8');
};

const printError = (ex) => console.error(ex);
const printInfo = (data) => console.info(data);

module.exports = {
  printInfo,
  writeFile,
  readFile,
  printError,
};
