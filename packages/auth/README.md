# @verii/auth

Authorization package

## Installation

```bash
yarn add @verii/auth
```

## Usage

```js
const { adminJwtAuthPlugin, createOauthConfig, initBasicAuthValidate } = require('@verii/auth');

// Use the exported members for your workflow.
```

## Entry Point

- `index.js`

## Top-level Exports

- `adminJwtAuthPlugin`
- `createOauthConfig`
- `initBasicAuthValidate`
- `initHasMatchingScope`
- `oauthPlugin`

## Development

Run from the repository root:

```bash
yarn workspace @verii/auth test
yarn workspace @verii/auth lint
```

