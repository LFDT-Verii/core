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
import { fileURLToPath, pathToFileURL } from 'url';
import path, { extname } from 'path';
import fs from 'fs/promises';

const SRC_ALIAS = '@';
const SRC_PATH = path.resolve(process.cwd(), 'src');

export const resolve = async (specifier, ctx, nextResolve) => {
  if (specifier.startsWith(`${SRC_ALIAS}/`)) {
    let resolvedPath = path.join(SRC_PATH, specifier.slice(SRC_ALIAS.length + 1));
    const ext = extname(specifier);
    if (ext === '') {
      // eslint-disable-next-line better-mutation/no-mutation
      resolvedPath += '.js';
    }
    // console.info(JSON.stringify({ resolver: 'alias', specifier, resolvedPath }));

    const fileUrl = pathToFileURL(resolvedPath).href;

    // Optionally check if the file exists before resolving
    try {
      await fs.access(fileURLToPath(fileUrl));
      return {
        url: fileUrl,
        shortCircuit: true,
      };
    } catch (e) {
      throw new Error(`Cannot resolve alias path: ${specifier}`);
    }
  }

  return nextResolve(specifier);
};
