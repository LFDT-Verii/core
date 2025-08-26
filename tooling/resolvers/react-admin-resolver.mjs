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
import { extname } from 'node:path';
import fs from 'fs/promises';
import { some } from 'lodash-es';

const REACT_ADMIN_PKGS = [
  'react-admin',
  'ra-core',
  'ra-ui-materialui',
  'ra-i18n-polyglot',
];

export const resolve = async (specifier, ctx, nextResolve) => {
  // force loading of esm react admin packages because they don't correctly specify exports
  if (REACT_ADMIN_PKGS.includes(specifier)) {
    return resolveReactAdminToEsm(specifier);
  }
  if (isReactAdminParent(ctx.parentURL)) {
    return resolveReactAdminImports(specifier, ctx, nextResolve);
  }
  return nextResolve(specifier);
};

const resolveReactAdminToEsm = (specifier) => {
  return {
    url: new URL(
      `../../node_modules/${specifier}/dist/esm/index.js`,
      import.meta.url
    ).href,
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
  spec.startsWith('./') ||
  spec.startsWith('../') ||
  spec === '.' ||
  spec === '..';

const isReactAdminParent = (parentUrl) =>
  some(REACT_ADMIN_PKGS, (pkg) => parentUrl?.includes(`/node_modules/${pkg}/`));

const isLodashSubpath = (specifier) =>
  includesSubpath(specifier) && specifier.startsWith('lodash');
const isJsonExportEsm = (specifier) =>
  includesSubpath(specifier) && specifier.startsWith('jsonexport');

const includesSubpath = (specifier) => specifier.includes('/');
