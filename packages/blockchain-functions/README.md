# @verii/blockchain-functions

Blockchain related wrappers and helpers.

## Installation

```bash
yarn add @verii/blockchain-functions
```

## Usage

```js
const { initGetBlock, initGetBlockNumber, initGetSignerMetrics } = require('@verii/blockchain-functions');

// Use the exported members for your workflow.
```

## Entry Point

- `index.js`

## Top-level Exports

- `initGetBlock`
- `initGetBlockNumber`
- `initGetSignerMetrics`
- `sendNoOpTx`
- `signAddress`
- `signArguments`
- `toEthereumAddress`
- `toHexString`
- `toNumber`

## Development

Run from the repository root:

```bash
yarn workspace @verii/blockchain-functions test
yarn workspace @verii/blockchain-functions lint
```

