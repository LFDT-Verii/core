const { existsSync } = require('fs');

const validateDirectoryExists = (options) => {
  if (options.dryrun == null && !existsSync(options.path)) {
    throw new Error('Path does not exist. Check the -p var');
  }
};

module.exports = {
  validateDirectoryExists,
};
