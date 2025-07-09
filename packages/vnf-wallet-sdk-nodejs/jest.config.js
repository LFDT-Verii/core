const { createDefaultPreset } = require('ts-jest');
const jestConfig = require('../../jest.config.base');
const pack = require('./package.json');

module.exports = {
    ...createDefaultPreset(),
    ...jestConfig(pack.name),
};
