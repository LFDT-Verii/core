import baseConfig from '../../eslint.config.mjs';

import jsdoc from 'eslint-plugin-jsdoc';

export default [
  // JSDoc recommended config
  jsdoc.configs['flat/recommended-error'],

  ...baseConfig,

  // JSDoc configuration for all files
  {
    files: ['**/*.{js,ts}'],
    plugins: {
      jsdoc,
    },
    rules: {
      'jsdoc/require-jsdoc': [
        'error',
        {
          require: {
            FunctionDeclaration: true,
            ArrowFunctionExpression: true,
            ClassDeclaration: true,
            ClassExpression: true,
            FunctionExpression: true,
            MethodDefinition: true,
          },
          exemptEmptyConstructors: true,
          checkConstructors: true,
        },
      ],
    },
  },

  // Test files - disable jsdoc requirement
  {
    files: ['*.test.js', 'test/**/*.js'],
    rules: {
      'jsdoc/require-jsdoc': 'off',
    },
  },

  // TypeScript declaration files
  {
    files: ['**/*.d.ts'],
    rules: {
      'no-unused-vars': 'off',
    },
  },
];
