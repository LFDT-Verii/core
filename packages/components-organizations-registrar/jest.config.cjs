const packageJson = require('./package.json');
const jestConfig = require('../../jest.config.base');

// Helper function for resolving paths
// const resolvePath = (relativePath) => path.resolve(__dirname, relativePath);

module.exports = {
  ...jestConfig(packageJson.name),
  roots: ['src'],
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
  setupFilesAfterEnv: ['./src/setupTests.cjs'],

  // setupFilesAfterEnv: ['@testing-library/jest-dom/extend-expect'],
};
