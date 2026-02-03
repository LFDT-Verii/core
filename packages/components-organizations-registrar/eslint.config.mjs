import path from 'path';
import { fileURLToPath } from 'url';
import baseConfig from '../../eslint.config.mjs';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

// eslint-disable-next-line no-underscore-dangle
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line no-underscore-dangle
const __dirname = path.dirname(__filename);

export default [
  ...baseConfig,

  // React configuration
  {
    files: ['**/*.{js,jsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.jest,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
      'import/resolver': {
        alias: {
          map: [['@', path.resolve(__dirname, 'src')]],
          extensions: ['.js', '.jsx', '.json'],
        },
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'import/extensions': ['error', 'always', { ignorePackages: true }],
      'react/forbid-prop-types': [
        'error',
        {
          forbid: ['any', 'array', 'object'],
          checkContextTypes: true,
          checkChildContextTypes: true,
        },
      ],
    },
  },

  // Ignore dist folder
  {
    ignores: ['dist/'],
  },
];
