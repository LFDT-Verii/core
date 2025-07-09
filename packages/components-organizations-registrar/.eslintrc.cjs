const path = require('path');
const eslintConfig = require('../../.eslintrc');

module.exports = {
  ...eslintConfig,
  plugins: eslintConfig.plugins.concat(['import']),
  root: true,
  extends: eslintConfig.extends.concat([
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ]),
  env: {
    es6: true,
    browser: true,
    jest: true,
  },
  settings: {
    'import/resolver': {
      alias: {
        map: [['@', path.resolve(__dirname, 'src')]],
        extensions: ['.js', '.jsx', '.json'],
      },
    },
  },
  ignorePatterns: ['dist/'],
};
