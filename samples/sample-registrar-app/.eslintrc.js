const eslintConfig = require('../../.eslintrc');

module.exports = {
  ...eslintConfig,
  root: true,
  extends: eslintConfig.extends.concat([
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ]),
  env: {
    es6: true,
    browser: true,
  },
  rules: {
    ...eslintConfig.rules,
    'import/no-unresolved': [
      'error',
      { ignore: ['@verii/components-organizations-registrar.*'] },
    ],
  },
};
