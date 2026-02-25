import baseConfig from '../eslint.config.mjs';
// eslint-disable-next-line no-unused-vars
import globals from 'globals';

export default [
  ...baseConfig,

  // Contracts-specific configuration
  {
    files: ['**/*.js'],
    rules: {
      'no-console': 'off',
      complexity: 'off',
      'max-depth': 'off',
      'max-len': 'off',
      'max-nested-callbacks': 'off',
      'no-await-in-loop': 'off',
      'no-underscore-dangle': 'off',
      'prefer-destructuring': 'off',
      'prettier/prettier': 'off',
      'better-mutation/no-mutation': 'off',
      'better-mutation/no-mutating-functions': 'off',
      'better-mutation/no-mutating-methods': 'off',
      'import/no-extraneous-dependencies': 'off',
      'prefer-arrow-functions/prefer-arrow-functions': 'off',
    },
  },

  // Test files configuration
  {
    files: ['**/test/**/*.test.js'],
    languageOptions: {
      globals: {
        after: 'readonly',
        afterEach: 'readonly',
        artifacts: 'readonly',
        assert: 'readonly',
        before: 'readonly',
        beforeEach: 'readonly',
        contract: 'readonly',
        describe: 'readonly',
        it: 'readonly',
      },
    },
    rules: {
      'max-len': 'off',
    },
  },

  // Migration files configuration
  {
    files: ['**/migrations/*.js'],
    languageOptions: {
      globals: {
        artifacts: 'readonly',
      },
    },
    rules: {
      'import/no-dynamic-require': 'off',
    },
  },

  // General test files
  {
    files: ['**/test/**/*.js'],
    languageOptions: {
      globals: {
        after: 'readonly',
        afterEach: 'readonly',
        before: 'readonly',
        beforeEach: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        web3: 'readonly',
      },
    },
    rules: {
      'no-plusplus': 'off',
    },
  },
];
