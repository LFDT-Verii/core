# @verii/server-provider

Server common package for Velocity Projects

## Installation

```bash
yarn add @verii/server-provider
```

## Usage

```js
const pkg = require('@verii/server-provider');

// Use the exported members for your workflow.
```

## Entry Point

- `index.js`

## Notes

- Unable to enumerate exports automatically in a standalone runtime: `Cannot find module '@fastify/helmet'`
- Refer to `index.js` for the package API.

## Development

Run from the repository root:

```bash
yarn workspace @verii/server-provider test
yarn workspace @verii/server-provider lint
```

