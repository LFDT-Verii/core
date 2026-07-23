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
const SCHEMA_COMPONENT_PREFIX = 'schemas/';

const isUnvisitedObject = (value, seen) =>
  value != null && typeof value === 'object' && !seen.has(value);

const getComponentReference = (value) =>
  typeof value.$ref === 'string' &&
  value.$ref.startsWith(COMPONENT_REFERENCE_PREFIX)
    ? value.$ref.slice(COMPONENT_REFERENCE_PREFIX.length)
    : null;

const getSchemaReference = (value) => {
  const componentReference = getComponentReference(value);
  return componentReference?.startsWith(SCHEMA_COMPONENT_PREFIX)
    ? componentReference.slice(SCHEMA_COMPONENT_PREFIX.length)
    : null;
};

const collectReferences = (
  value,
  getReference,
  references = new Set(),
  seen = new WeakSet(),
) => {
  if (!isUnvisitedObject(value, seen)) {
    return references;
  }

  seen.add(value);
  const reference = getReference(value);
  if (reference != null) {
    references.add(reference);
  }

  for (const child of Object.values(value)) {
    collectReferences(child, getReference, references, seen);
  }

  return references;
};

const collectSchemaReferences = (value) =>
  collectReferences(value, getSchemaReference);

const collectComponentReferences = (value) =>
  collectReferences(value, getComponentReference);

const getReferencedNonSchemaComponent = (openapiObject, reference) => {
  const [componentType, componentName] = reference.split('/');
  return componentType === 'schemas'
    ? null
    : openapiObject.components?.[componentType]?.[componentName];
};

const collectPathSchemaReferences = (openapiObject) => {
  const schemaReferences = new Set();
  const followedComponentReferences = new Set();
  const componentReferences = [
    ...collectComponentReferences(openapiObject.paths),
  ];

  for (let i = 0; i < componentReferences.length; i += 1) {
    const componentReference = componentReferences[i];
    const schemaReference = componentReference.startsWith(
      SCHEMA_COMPONENT_PREFIX,
    )
      ? componentReference.slice(SCHEMA_COMPONENT_PREFIX.length)
      : null;
    if (schemaReference != null) {
      schemaReferences.add(schemaReference);
    }

    const component = getReferencedNonSchemaComponent(
      openapiObject,
      componentReference,
    );
    if (
      component != null &&
      !followedComponentReferences.has(componentReference)
    ) {
      followedComponentReferences.add(componentReference);
      componentReferences.push(...collectComponentReferences(component));
    }
  }

  return schemaReferences;
};

const pruneUnreferencedSchemas = (openapiObject) => {
  const schemas = openapiObject.components?.schemas;
  if (schemas == null) {
    return openapiObject;
  }

  const reachable = new Set();
  const pending = [...collectPathSchemaReferences(openapiObject)];

  while (pending.length > 0) {
    const schemaName = pending.pop();
    if (!reachable.has(schemaName)) {
      reachable.add(schemaName);
      pending.push(...collectSchemaReferences(schemas[schemaName]));
    }
  }

  return {
    ...openapiObject,
    components: {
      ...openapiObject.components,
      schemas: Object.fromEntries(
        Object.entries(schemas).filter(([schemaName]) =>
          reachable.has(schemaName),
        ),
      ),
    },
  };
};

module.exports = { pruneUnreferencedSchemas };
