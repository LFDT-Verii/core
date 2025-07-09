/*
 * Copyright 2025 Velocity Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

const eslintConfig = require('../../.eslintrc');

module.exports = {
  ...eslintConfig,
  root: true,
  extends: ['plugin:jsdoc/recommended-error'].concat(eslintConfig.extends),
  plugins: eslintConfig.plugins.concat(['@typescript-eslint']),
  rules: {
    ...eslintConfig.rules,
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
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ...eslintConfig.parserOptions,
    ts: '@typescript-eslint/parser',
  },
  overrides: eslintConfig.overrides.concat([
    {
      files: ['*.test.js', 'test/**/*.js'], // Or *.test.js
      rules: {
        'jsdoc/require-jsdoc': 'off',
      },
    },
    {
      files: ['**/*.d.ts'],
      rules: {
        'no-unused-vars': ['off'],
      },
    },
  ]),
};
