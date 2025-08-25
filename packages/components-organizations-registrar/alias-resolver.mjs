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
import { some } from 'lodash-es';

const SRC_ALIAS = '@';
const SRC_PATH = path.resolve(process.cwd(), 'src');
const REACT_ADMIN_PKGS = ['react-admin', 'ra-core', 'ra-ui-materialui', 'ra-i18n-polyglot'];

export const resolve = async (specifier, ctx, nextResolve) => {
  if (REACT_ADMIN_PKGS.includes(specifier)) {
    return resolveReactAdminToEsm(specifier);
  }

  if (isReactAdminParent(ctx.parentURL)) {
    return resolveReactAdminImports(specifier, ctx, nextResolve);
  }

  if (specifier.startsWith(`${SRC_ALIAS}/`)) {
    return resolveSrcAlias(specifier);
  }

  return nextResolve(specifier);
};

const resolveSrcAlias = async (specifier) => {
  let resolvedPath = path.join(SRC_PATH, specifier.slice(SRC_ALIAS.length + 1));
  const ext = extname(specifier);
  if (ext === '') {
    // eslint-disable-next-line better-mutation/no-mutation
    resolvedPath += '.js';
  }

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
};

const resolveReactAdminToEsm = (specifier) => {
  return {
    url: new URL(`../../node_modules/${specifier}/dist/esm/index.js`, import.meta.url).href,
    shortCircuit: true,
  };
};

/* eslint-disable max-depth */
/* eslint-disable complexity */
const resolveReactAdminImports = async (specifier, ctx, nextResolve) => {
  if (isRel(specifier) && !['js', 'mjs', 'cjs'].includes(extname(specifier))) {
    const base = new URL(specifier, ctx.parentURL);

    const candidates = [
      `${base.href}.js`,
      new URL(specifier.replace(/\/?$/, '/index.js'), ctx.parentURL).href,
    ];

    for (const url of candidates) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await fs.access(fileURLToPath(url));
        return { url, shortCircuit: true };
      } catch {
        // do nothing
      }
    }
  }
  if (isLodashSubpath(specifier)) {
    return nextResolve(`${specifier}.js`);
  }
  if (isJsonExportEsm(specifier)) {
    return nextResolve(`${specifier}/index.js`);
  }

  return nextResolve(specifier);
};

const isRel = (spec) =>
  spec.startsWith('./') || spec.startsWith('../') || spec === '.' || spec === '..';

const isReactAdminParent = (parentUrl) =>
  some(REACT_ADMIN_PKGS, (pkg) => parentUrl?.includes(`/node_modules/${pkg}/`));

const includesSubpath = (specifier) => specifier.includes('/');

const isLodashSubpath = (specifier) => includesSubpath(specifier) && specifier.startsWith('lodash');
const isJsonExportEsm = (specifier) =>
  includesSubpath(specifier) && specifier.startsWith('jsonexport');
