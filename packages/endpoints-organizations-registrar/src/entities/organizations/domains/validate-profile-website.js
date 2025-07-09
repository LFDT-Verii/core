const newError = require('http-errors');

const validateProfileWebsite = ({ profile }) => {
  const url = new URL(profile.website);
  if (url.protocol !== 'https:') {
    throw newError(400, 'Website protocol must be https', {
      errorCode: 'website_protocol_must_be_https',
    });
  }
  if (url.pathname !== '/' || `${profile.website}/` !== url.href) {
    throw newError(400, 'Website must have empty path after domain', {
      errorCode: 'website_path_must_be_empty',
    });
  }
};

module.exports = { validateProfileWebsite };
