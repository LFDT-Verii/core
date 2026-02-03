import baseConfig from '../eslint.config.mjs';
// eslint-disable-next-line import/no-extraneous-dependencies, no-unused-vars
import globals from 'globals';

export default [
  ...baseConfig,

  // Contracts-specific configuration
  {
    files: ['**/*.js'],
    rules: {
      'no-console': 'off',
    },
  },

  // Test files configuration
  {
    files: ['**/test/*.test.js'],
    languageOptions: {
      globals: {
        artifacts: 'readonly',
        assert: 'readonly',
        contract: 'readonly',
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
    files: ['**/test/*.js'],
    languageOptions: {
      globals: {
        before: 'readonly',
        web3: 'readonly',
      },
    },
    rules: {
      'no-plusplus': 'off',
    },
  },
];
