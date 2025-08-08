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
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
// eslint-disable-next-line import/no-extraneous-dependencies
import swc from '@swc/core';
import { extname } from 'path';

export const resolve = async (specifier, context, nextResolve) => {
  const ext = extname(specifier);
  if (ext === 'jsx') {
    // console.info(JSON.stringify({ resolver: 'jsx', specifier }));

    const resolved = await nextResolve(specifier, context);
    return {
      ...resolved,
      format: 'module',
    };
  }

  return nextResolve(specifier, context);
};

export const load = async (url, context, nextLoad) => {
  if (url.endsWith('.jsx')) {
    const filepath = fileURLToPath(url);
    const code = await readFile(filepath, 'utf8');

    const { code: transformedCode } = await swc.transform(code, {
      filename: filepath,
      jsc: {
        parser: {
          syntax: 'ecmascript',
          jsx: true,
        },
        target: 'es2020',
        transform: {
          react: {
            runtime: 'automatic', // or "classic" if you prefer React.createElement
          },
        },
      },
      sourceMaps: 'inline',
      module: {
        type: 'es6',
      },
    });

    return {
      format: 'module',
      source: transformedCode,
      shortCircuit: true,
    };
  }

  return nextLoad(url, context);
};
