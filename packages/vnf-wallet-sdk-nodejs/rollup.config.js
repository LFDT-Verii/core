import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
    input: ['src/index.ts'],
    output: [
        {
            dir: 'dist',
            entryFileNames: '[name].js',
            format: 'cjs',
            exports: 'named',
            sourcemap: true,
        },
    ],
    plugins: [typescript(), nodeResolve()],
};
