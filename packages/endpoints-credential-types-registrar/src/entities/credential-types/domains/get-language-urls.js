const { compact } = require('lodash/fp');

const getLanguageUrls = ({ locale, urls = {} }) => {
  const [language] = (locale ?? '').split('_');
  return compact([urls[locale], urls[language], urls.en]);
};

module.exports = { getLanguageUrls };
