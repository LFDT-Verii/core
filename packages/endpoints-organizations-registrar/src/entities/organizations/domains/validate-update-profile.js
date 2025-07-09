const newError = require('http-errors');

const validateUpdateProfile = (profile) => {
  if (profile.website != null) {
    throw newError(400, 'Website must not be specified', {
      errorCode: 'website_must_not_be_specified',
    });
  }
};

module.exports = { validateUpdateProfile };
