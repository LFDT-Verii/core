const console = require('console');

const printError = (ex) => console.error(ex);
const printInfo = (data) => console.info(data);

module.exports = {
  printInfo,
  printError,
};
