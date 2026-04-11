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

- `adminJwtAuthPlugin` - auth for administrator endpoints
- `createOauthConfig` - for creating authentication swagger configuration
- `initBasicAuthValidate` - for basic auth protected endpoints
- `initHasMatchingScope` - for permissioning
- `oauthPlugin` - auth for regular endpoints

## Development

Run from the repository root:

```bash
yarn workspace @verii/auth test
yarn workspace @verii/auth lint
```

