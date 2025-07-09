const newError = require('http-errors');

const verifyProfileWebsiteUnique = async ({ profile }, context) => {
  const count = await context.repos.organizations.count({
    filter: { 'profile.website': profile.website },
  });

  if (count > 0) {
    throw newError(400, 'Website already exists', {
      errorCode: 'website_already_exists',
    });
  }
};

module.exports = { verifyProfileWebsiteUnique };
