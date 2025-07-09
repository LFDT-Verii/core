const { createDefaultPreset } = require('ts-jest');
const pack = require('./package.json');
const jestConfig = require('../../jest.config.base');

module.exports = {
  ...createDefaultPreset(),
  ...jestConfig(pack.name),
  testEnvironment: 'jsdom',
  transform: { '^.+\\.[jt]sx?$': '@swc/jest' },
  transformIgnorePatterns: ['node_modules/', '\\.(css|scss|sass)$'],

  // Recognized file extensions for modules
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  // moduleDirectories: ['node_modules', 'src'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1', // Maps @/ to src/
    '^@shared/(.*)$': '<rootDir>/src/shared/$1', // Maps @shared/ to src/shared/
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },
};
