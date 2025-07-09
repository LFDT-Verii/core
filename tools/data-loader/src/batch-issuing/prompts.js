const { prompt } = require('inquirer');
const { format, parseISO } = require('date-fns');
const { take, map, flow } = require('lodash/fp');

const disclosureListQuestion = (disclosures) => ({
  type: 'list',
  name: 'disclosure',
  message: 'Please select a disclosure',
  choices: flow(
    take(10),
    map((disclosure) => ({
      name: `${disclosure.purpose}, ${format(
        parseISO(disclosure.createdAt),
        'MMM d yyyy h:mma'
      )}`,
      value: disclosure.id,
    }))
  )(disclosures),
});

const askQuestion = async (question) => {
  const result = await prompt([question]);
  return result[question.name];
};

const askDisclosureType = () =>
  askQuestion({
    type: 'list',
    name: 'disclosureType',
    message:
      'Would you like to use an existing disclosure or create a new one?',
    choices: ['existing', 'new'],
  });
const askUseNewDisclosure = () =>
  askQuestion({
    type: 'confirm',
    name: 'useNewDisclosure',
    message: 'The batch will create a new disclosure. Press enter to confirm.',
  });
const askDisclosureList = (disclosures) =>
  askQuestion(disclosureListQuestion(disclosures));

module.exports = {
  askDisclosureType,
  askDisclosureList,
  askUseNewDisclosure,
};
