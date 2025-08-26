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
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
// eslint-disable-next-line import/no-extraneous-dependencies
import swc from '@swc/core';
import { extname } from 'node:path';

/**
 *
 * This hook is used to modify the source of JSX/TSX files on the fly.
 * We prepend the necessary React import to ensure React is available,
 * which is required for JSX to work without explicitly importing React.
 *
 * @type {import('node:module').LoadHook}
 */

export const load = async (url, context, nextLoad) => {
  const ext = extname(url);
  if (ext === '.jsx' || ext === '.tsx') {
    const filepath = fileURLToPath(url);
    const code = await readFile(filepath, 'utf8');
    const { code: transformedCode } = await swc.transform(code, {
      filename: filepath,
      jsc: {
        parser: {
          syntax: ext === '.tsx' ? 'typescript' : 'ecmascript',
          jsx: true,
        },
        target: 'es2020',
        transform: {
          react: {
            runtime: 'automatic',
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
