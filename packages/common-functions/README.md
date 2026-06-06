# @verii/common-functions

Set of functions and utils used by Verii projects

## Installation

```bash
yarn add @verii/common-functions
```

## Usage

```js
const { appendSearchParam, appendSearchParamArray, applyOverrides } = require('@verii/common-functions');

// Use the exported members for your workflow.
```

## Entry Point

- `index.js`

## Top-level Exports

- `appendSearchParam`
- `appendSearchParamArray`
- `applyOverrides`
- `bytes32toString`
- `coerceArray`
- `dateify`
- `filterValidEntities`
- `findIndexWithIndex`
- `formatAsDate`
- `idKeyMapper`
- `leafMap`
- `mapValuesByKey`
- `mapWithIndex`
- `normalizeDisplayDescriptorName`
- `normalizeFormSchemaName`
- `normalizeJsonSchemaName`
- `optional`
- `prepCamelCase`
- `promisify`
- `reduceWithIndex`
- ... and 4 more (see `index.js`)

## Development

Run from the repository root:

```bash
yarn workspace @verii/common-functions test
yarn workspace @verii/common-functions lint
```

