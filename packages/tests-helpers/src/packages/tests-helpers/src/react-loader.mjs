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
import { extname } from 'path';

const requiredCode = "import * as React from 'react';";
const css = new URL('mocks/css.mjs', import.meta.url).href;

/**
 *
 * This hook intercepts module resolution, allowing us to handle
 * CSS/SCSS files in a custom way. Instead of actually loading the CSS,
 * we short-circuit the resolution and return a mock module.
 *
 * @type {import('node:module').ResolveHook}
 */
export const resolve = async (specifier, ctx, nextResolve) => {
  const ext = extname(specifier);
  if (ext === '.css' || ext === '.scss') {
    // console.info(JSON.stringify({ resolver: 'css', specifier }));

    // For CSS/SCSS, return the mock CSS module and skip default resolution.
    return {
      format: 'module',
      url: css,
      shortCircuit: true,
    };
  }

  // console.info(JSON.stringify({ resolver: 'none', specifier }));
  return nextResolve(specifier);
};

/**
 *
 * This hook is used to modify the source of JSX/TSX files on the fly.
 * We prepend the necessary React import to ensure React is available,
 * which is required for JSX to work without explicitly importing React.
 *
 * @type {import('node:module').LoadHook}
 */
export const load = async (url, ctx, nextLoad) => {
  const ext = extname(url);
  const result = await nextLoad(url, ctx);

  if (ext === '.jsx' || ext === '.tsx') {
    // Ensure React is in scope for JSX transforms.
    // eslint-disable-next-line better-mutation/no-mutation
    result.source = requiredCode + result.source;
  }

  return result;
};
