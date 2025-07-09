const { split } = require('lodash/fp');

const extractDid = (uri) => {
  const newUrl = new URL(decodeURIComponent(uri));
  const parts = split('/', newUrl.pathname);
  return parts[5];
};

module.exports = {
  extractDid,
};
