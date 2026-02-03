/* eslint-disable import/no-extraneous-dependencies */
import { configs } from 'eslint-config-airbnb-extended/legacy';
import globals from 'globals';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import betterMutation from 'eslint-plugin-better-mutation';
import preferArrowFunctions from 'eslint-plugin-prefer-arrow-functions';
import autofixPlugin from 'eslint-plugin-autofix';
import typescriptEslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';

const baseConfig = [
  // Airbnb base configuration (legacy mode for compatibility with eslintrc Airbnb rules)
  ...configs.base.legacy,

  // Prettier configuration (disables conflicting rules)
  prettierConfig,

  // Global ignores
  {
    ignores: ['**/dist/', '**/node_modules/', '**/build/', '**/coverage/'],
  },

  // Base configuration for all JS files
  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        ...globals.commonjs,
        ...globals.es2020,
        ...globals.node,
        Atomics: 'readonly',
        SharedArrayBuffer: 'readonly',
        BigInt: 'readonly',
      },
    },
    plugins: {
      prettier: prettierPlugin,
      'better-mutation': betterMutation,
      'prefer-arrow-functions': preferArrowFunctions,
      autofix: autofixPlugin,
      import: importPlugin,
    },
    rules: {
      'no-useless-constructor': 'off',
      'no-empty-function': 'off',
      'no-plusplus': 'off',
      'autofix/no-debugger': 'error',
      'better-mutation/no-mutation': [
        'error',
        {
          commonjs: true,
          allowThis: true,
          reducers: ['reduce', 'addHook', 'decorate'],
        },
      ],
      'better-mutation/no-mutating-functions': 'error',
      'better-mutation/no-mutating-methods': 'error',
      'comma-dangle': [
        2,
        {
          arrays: 'always-multiline',
          objects: 'always-multiline',
          imports: 'always-multiline',
          exports: 'always-multiline',
          functions: 'ignore',
        },
      ],
      complexity: ['error', 6],
      'global-require': 'off',
      'max-depth': ['error', { max: 2 }],
      'max-len': ['error', { code: 150 }],
      'max-nested-callbacks': ['error', 3],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-param-reassign': 0,
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ForInStatement',
          message:
            // eslint-disable-next-line max-len
            'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.',
        },
        {
          selector: 'LabeledStatement',
          message:
            'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
        },
        {
          selector: 'WithStatement',
          message:
            '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
        },
      ],
      // eslint-disable-next-line prettier/prettier
      'no-underscore-dangle': ['error', { allowAfterThis: true, allow: ['_id'] }],
      'no-unused-vars': ['error', { varsIgnorePattern: '^React$' }],
      'no-use-before-define': 0,
      'prefer-destructuring': [
        'error',
        {
          array: false,
          object: true,
        },
        {
          enforceForRenamedProperties: false,
        },
      ],
      'prettier/prettier': ['error', { singleQuote: true, endOfLine: 'auto' }],
      'prefer-arrow-functions/prefer-arrow-functions': [
        'warn',
        {
          classPropertiesAllowed: false,
          disallowPrototype: false,
          returnStyle: 'unchanged',
          singleReturnOnly: false,
        },
      ],
      quotes: [2, 'single', { avoidEscape: true }],
      'import/prefer-default-export': 'off',
      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: [
            '**/*.test.js',
            '**/*.test.jsx',
            '**/*.test.ts',
            '**/*.test.tsx',
            '**/e2e/**/*.js',
            '**/e2e/**/*.ts',
            '**/e2e/**/*.jsx',
            '**/e2e/**/*.tsx',
            '**/test/**/*.js',
            '**/test/**/*.ts',
            '**/test/**/*.jsx',
            '**/test/**/*.tsx',
            '**/setupTests.ts',
            '**/setupTests.js',
            '**/vite.config.js',
            '**/eslint.config.mjs',
          ],
        },
      ],
      'import/extensions': [
        'error',
        'ignorePackages',
        { js: 'never', ts: 'never', jsx: 'always', tsx: 'always' },
      ],
    },
  },

  // Test files - relaxed mutation rules
  {
    files: [
      '**/e2e/**/*.{js,ts,jsx,tsx}',
      '**/*.test.{js,jsx,ts,tsx}',
      '**/test/**/*.{js,ts}',
    ],
    rules: {
      'better-mutation/no-mutating-functions': 'off',
      'better-mutation/no-mutating-methods': 'off',
      'better-mutation/no-mutation': 'off',
      'max-nested-callbacks': ['error', 8],
      'no-constructor-return': 'off',
      'max-classes-per-file': 'off',
    },
  },

  // TypeScript files
  ...typescriptEslint.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptEslint.parser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint.plugin,
    },
    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
          paths: ['./'],
        },
        typescript: {
          project: ['./tsconfig.json'],
        },
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'class-methods-use-this': 'off',
    },
  },
];

export default baseConfig;
