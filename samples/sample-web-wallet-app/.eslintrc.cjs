const eslintConfig = require('../../.eslintrc');

module.exports = {
  ...eslintConfig,
  root: true,
  extends: [
    ...eslintConfig.extends,
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
};
