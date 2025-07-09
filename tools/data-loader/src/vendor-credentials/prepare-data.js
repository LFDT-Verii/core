const { map } = require('lodash/fp');
const {
  loadHandlebarsTemplate,
} = require('../helpers/load-handlebars-template');
const { prepareVariableSets } = require('../helpers');

const prepareData = async (csvHeaders, csvRows, options) => {
  const variableSets = await prepareVariableSets(csvHeaders, csvRows, options);

  const { offerTemplateFilename, personTemplateFilename, label } = options;
  const offerTemplate = loadHandlebarsTemplate(offerTemplateFilename);
  const personTemplate = personTemplateFilename
    ? loadHandlebarsTemplate(personTemplateFilename)
    : undefined;
  return map((variableSet) => {
    return {
      offer: prepareDocument({ template: offerTemplate, variableSet, label }),
      person: personTemplate
        ? prepareDocument({ template: personTemplate, variableSet, label })
        : undefined,
    };
  }, variableSets);
};

const prepareDocument = ({ template, variableSet, label }) => {
  const offerString = template(variableSet);
  const json = JSON.parse(offerString);
  return {
    ...json,
    label,
  };
};

module.exports = {
  prepareData,
};
