import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['local/**/*.mjs'],
    rules: {
      'better-mutation/no-mutation': 'off',
      'better-mutation/no-mutating-methods': 'off',
      complexity: 'off',
      'max-depth': 'off',
    },
  },
];
