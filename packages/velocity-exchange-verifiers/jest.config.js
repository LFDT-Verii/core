const { createDefaultPreset } = require('ts-jest');
const { pathsToModuleNameMapper } = require('ts-jest');
const jestConfig = require('../../jest.config.base');
const pack = require('./package.json');
const { compilerOptions } = require('./tsconfig.json');

module.exports = {
  ...createDefaultPreset(),
  ...jestConfig(pack.name),
  moduleNameMapper: {
    ...pathsToModuleNameMapper(compilerOptions.paths, {
      prefix: '<rootDir>/',
    }),
  },
};
