/*
 * Copyright 2026 Velocity Team
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

const COMPONENT_REFERENCE_PREFIX = '#/components/';
const PRUNABLE_COMPONENT_REGISTRIES = new Set([
  'callbacks',
  'examples',
  'headers',
  'links',
  'parameters',
  'pathItems',
  'requestBodies',
  'responses',
  'schemas',
]);

const isUnvisitedObject = (value, seen) =>
  value != null && typeof value === 'object' && !seen.has(value);

const getComponentReference = (value) => {
  return typeof value.$ref === 'string' &&
    value.$ref.startsWith(COMPONENT_REFERENCE_PREFIX)
    ? value.$ref.slice(COMPONENT_REFERENCE_PREFIX.length)
    : null;
};

const collectComponentReferences = (
  value,
  references = new Set(),
  seen = new WeakSet(),
) => {
  if (!isUnvisitedObject(value, seen)) {
    return references;
  }

  seen.add(value);
  const reference = getComponentReference(value);
  if (reference != null) {
    references.add(reference);
  }

  for (const child of Object.values(value)) {
    collectComponentReferences(child, references, seen);
  }

  return references;
};

const decodeJsonPointerToken = (token) =>
  token.replaceAll('~1', '/').replaceAll('~0', '~');

const encodeJsonPointerToken = (token) =>
  token.replaceAll('~', '~0').replaceAll('/', '~1');

const getComponentEntryReference = (reference) =>
  reference.split('/').slice(0, 2).join('/');

const getReferencedComponentEntry = (components, reference) => {
  const [registryToken, entryToken] = reference.split('/');
  const registryName = decodeJsonPointerToken(registryToken);
  const entryName = decodeJsonPointerToken(entryToken);
  return components[registryName]?.[entryName];
};

const getPreservedComponentData = (components) =>
  Object.fromEntries(
    Object.entries(components).filter(
      ([name]) => !PRUNABLE_COMPONENT_REGISTRIES.has(name),
    ),
  );

const collectReachableComponentEntries = (openapiObject) => {
  const { components } = openapiObject;
  const reachable = new Set();
  const componentReferences = [
    ...collectComponentReferences({
      paths: openapiObject.paths,
      preservedComponents: getPreservedComponentData(components),
    }),
  ];

  for (let i = 0; i < componentReferences.length; i += 1) {
    const entryReference = getComponentEntryReference(componentReferences[i]);
    if (!reachable.has(entryReference)) {
      reachable.add(entryReference);
      componentReferences.push(
        ...collectComponentReferences(
          getReferencedComponentEntry(components, entryReference),
        ),
      );
    }
  }

  return reachable;
};

const pruneComponentRegistry = (registryName, registry, reachable) =>
  Object.fromEntries(
    Object.entries(registry).filter(([entryName]) =>
      reachable.has(
        `${encodeJsonPointerToken(registryName)}/${encodeJsonPointerToken(
          entryName,
        )}`,
      ),
    ),
  );

const pruneUnreferencedComponents = (openapiObject) => {
  if (openapiObject.components == null) {
    return openapiObject;
  }

  const reachable = collectReachableComponentEntries(openapiObject);
  return {
    ...openapiObject,
    components: Object.fromEntries(
      Object.entries(openapiObject.components).map(([name, value]) => [
        name,
        PRUNABLE_COMPONENT_REGISTRIES.has(name)
          ? pruneComponentRegistry(name, value, reachable)
          : value,
      ]),
    ),
  };
};

module.exports = { pruneUnreferencedComponents };
