# @verii/base-contract-io

Package contains functions needed across all contract io packages

## Installation

```bash
yarn add @verii/base-contract-io
```

## Usage

```js
const { authenticateVnfClientPlugin, initAuthenticateVnfBlockchainClient, initAuthenticateVnfClient } = require('@verii/base-contract-io');

// Use the exported members for your workflow.
```

## Entry Point

- `index.js`

## Top-level Exports

- `authenticateVnfClientPlugin`
- `initAuthenticateVnfBlockchainClient`
- `initAuthenticateVnfClient`
- `initAuthenticateVnfClientPlugin`
- `initContractClient`
- `initContractWithTransactingClient`
- `initProvider`
- `rpcProviderPlugin`
- `setProvider`

## Development

Run from the repository root:

```bash
yarn workspace @verii/base-contract-io test
yarn workspace @verii/base-contract-io lint
```

