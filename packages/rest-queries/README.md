# @verii/rest-queries

Http REST Query language

## Installation

```bash
yarn add @verii/rest-queries
```

## Usage

```js
const { DEFAULT_SIZE, DEFAULT_SKIP, SORT_ASC } = require('@verii/rest-queries');

// Use the exported members for your workflow.
```

## Entry Point

- `index.js`

## Top-level Exports

- `DEFAULT_SIZE`
- `DEFAULT_SKIP`
- `SORT_ASC`
- `SORT_DESC`
- `buildPaginatedResponse`
- `customFastifyQueryStringParser`
- `initTransformToFilterDocument`
- `initTransformToFinder`
- `toEndOfDay`
- `toStartOfDay`
- `transformSortTupleArrayToMongoSortObject`
- `transformToDocumentSkip`
- `transformToPageSize`
- `transformToSortDocument`
- `validateSortDirection`

## Development

Run from the repository root:

```bash
yarn workspace @verii/rest-queries test
yarn workspace @verii/rest-queries lint
```

