const Handlebars = require('handlebars');
const { readFile } = require('./common');

const loadHandlebarsTemplate = (filename) => {
  const templateString = readFile(filename);
  return Handlebars.compile(templateString);
};

module.exports = { loadHandlebarsTemplate };
