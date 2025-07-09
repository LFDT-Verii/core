const { createDefaultPreset } = require('ts-jest');
const pack = require('./package.json');
const jestConfig = require('../../jest.config.base');

module.exports = {
  ...createDefaultPreset(),
  ...jestConfig(pack.name),
};
