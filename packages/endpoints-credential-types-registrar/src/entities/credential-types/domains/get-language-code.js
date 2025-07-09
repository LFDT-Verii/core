const getLanguageCode = (prefix, url) => {
  const languageRegex = new RegExp(`/${prefix}/(\\w+)/.+`);
  const match = url.match(languageRegex);
  const languageCode = match ? match[1] : null;
  return languageCode;
};

module.exports = { getLanguageCode };
