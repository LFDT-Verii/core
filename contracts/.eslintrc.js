module.exports = {
  rules: {
    'no-console': 'off',
  },
  overrides: [
    {
      files: ['**/test/*.test.js'],
      rules: {
        'max-len': 'off',
      },
      globals: {
        artifacts: 'readonly',
        assert: 'readonly',
        contract: 'readonly',
      },
    },
    {
      files: ['**/migrations/*.js'],
      rules: {
        'import/no-dynamic-require': 'off',
      },
      globals: {
        artifacts: 'readonly',
      },
    },
    {
      files: ['**/test/*.js'],
      rules: {
        'no-plusplus': 'off',
      },
      globals: {
        before: 'readonly',
        web3: 'readonly',
      },
    },
  ],
};
