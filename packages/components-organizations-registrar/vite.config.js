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
import { fileURLToPath } from 'url';
import react from '@vitejs/plugin-react-swc';
import { libInjectCss } from 'vite-plugin-lib-inject-css';

const isTracingEnabled = (mode) => mode === 'development' || process.env.TRACING_ENABLED === '1';
const packageDir = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __TRACING_ENABLED__: JSON.stringify(isTracingEnabled(mode)),
  },
  // Automatically externalizes deps based on package.json
  plugins: [libInjectCss(), externalizeDeps({}), react()],
  resolve: {
    alias: {
      '@': path.resolve(packageDir, 'src'),
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
        index: path.resolve(packageDir, 'src/index.jsx'), // Don't forget the main entry!
        components: path.resolve(packageDir, 'src/components/index.jsx'),
        'components/AppBar': path.resolve(packageDir, 'src/components/AppBar/index.jsx'),
        'components/common': path.resolve(packageDir, 'src/components/common/index.jsx'),
        'components/invitations': path.resolve(packageDir, 'src/components/invitations/index.jsx'),
        'components/organizations': path.resolve(
          packageDir,
          'src/components/organizations/index.jsx',
        ),
        'components/services': path.resolve(packageDir, 'src/components/services/index.jsx'),
        constants: path.resolve(packageDir, 'src/constants/index.js'),
        layouts: path.resolve(packageDir, 'src/layouts/index.jsx'),
        pages: path.resolve(packageDir, 'src/pages/index.jsx'),
        'pages/individuals': path.resolve(packageDir, 'src/pages/individuals/index.jsx'),
        'pages/invitations': path.resolve(packageDir, 'src/pages/invitations/index.jsx'),
        'pages/organizations': path.resolve(packageDir, 'src/pages/organizations/index.jsx'),
        'pages/services': path.resolve(packageDir, 'src/pages/services/index.jsx'),
      },
    },
  },
}));
