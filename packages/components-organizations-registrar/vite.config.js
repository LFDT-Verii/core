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

import { defineConfig } from 'vite';
import { externalizeDeps } from 'vite-plugin-externalize-deps';
import path from 'path';
import react from '@vitejs/plugin-react-swc';
import { libInjectCss } from 'vite-plugin-lib-inject-css';

// https://vite.dev/config/
export default defineConfig({
  // Automatically externalizes deps based on package.json
  plugins: [libInjectCss(), externalizeDeps({}), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    minify: false,
    sourcemap: true,
    rollupOptions: {
      output: {
        // Put chunk files at <output>/chunks
        chunkFileNames: 'chunks/[name].[hash].js',
        // Put chunk styles at <output>/styles
        assetFileNames: 'assets/[name][extname]',
      },
    },
    lib: {
      format: ['es'],
      entry: {
        index: path.resolve(__dirname, 'src/index.jsx'), // Don't forget the main entry!
        components: path.resolve(__dirname, 'src/components/index.jsx'),
        'components/AppBar': path.resolve(__dirname, 'src/components/AppBar/index.jsx'),
        'components/common': path.resolve(__dirname, 'src/components/common/index.jsx'),
        'components/invitations': path.resolve(__dirname, 'src/components/invitations/index.jsx'),
        'components/organizations': path.resolve(
          __dirname,
          'src/components/organizations/index.jsx',
        ),
        'components/services': path.resolve(__dirname, 'src/components/services/index.jsx'),
        constants: path.resolve(__dirname, 'src/constants/index.js'),
        layouts: path.resolve(__dirname, 'src/layouts/index.jsx'),
        pages: path.resolve(__dirname, 'src/pages/index.jsx'),
        'pages/individuals': path.resolve(__dirname, 'src/pages/individuals/index.jsx'),
        'pages/invitations': path.resolve(__dirname, 'src/pages/invitations/index.jsx'),
        'pages/organizations': path.resolve(__dirname, 'src/pages/organizations/index.jsx'),
        'pages/services': path.resolve(__dirname, 'src/pages/services/index.jsx'),
      },
    },
  },
});
