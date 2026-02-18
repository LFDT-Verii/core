# @verii/aws-clients

Set of aws functions and utils used by Verii projects

## Installation

```bash
yarn add @verii/aws-clients
```

## Usage

```js
const pkg = require('@verii/aws-clients');

// Use the exported members for your workflow.
```

## Entry Point

- `index.js`

## Notes

- Unable to enumerate exports automatically in a standalone runtime: `Cannot find module '@aws-sdk/client-dynamodb'`
- Refer to `index.js` for the package API.

## Development

Run from the repository root:

```bash
yarn workspace @verii/aws-clients test
yarn workspace @verii/aws-clients lint
```

