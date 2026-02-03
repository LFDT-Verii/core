import baseConfig from '../../eslint.config.mjs';

export default [
    ...baseConfig,
    {
        files: ['**/test/**/*.ts'],
        rules: {
            'max-len': 'off',
        },
    },
];
