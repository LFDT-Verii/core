import baseConfig from '../../eslint.config.mjs';

export default [
    {
        ignores: [
            '**/babel.config.js',
            '**/setupJestAfterEnv.js',
            '**/.yarn/*',
            '**/rollup.config.js',
        ],
    },
    ...baseConfig,
    {
        files: ['**/test/**/*.ts'],
        rules: {
            'max-len': 'off',
        },
    },
];
