# @verii/fineract-client

Package containing the functions that interact with the fineract system

## Installation

```bash
yarn add @verii/fineract-client
```

## Usage

```js
const { ProductIds, batchOperations, batchTransferCredits } = require('@verii/fineract-client');

// Use the exported members for your workflow.
```

## Entry Point

- `index.js`

## Top-level Exports

- `ProductIds`
- `batchOperations`
- `batchTransferCredits`
- `buildBurnVouchersPayload`
- `buildCreateClientPayload`
- `buildCreateCreditsAccountPayload`
- `buildTransferCreditsPayload`
- `createClient`
- `createCreditsAccount`
- `createEscrowAccount`
- `createFineractClient`
- `createStakesAccount`
- `createVouchers`
- `getClientVoucherBalance`
- `getCreditsAccount`
- `getCreditsAccountTransactions`
- `getExpiringVouchers`
- `getVouchers`
- `initBuildBatchBurnVouchersPayload`
- `initBuildBatchCreateClientPayload`
- ... and 4 more (see `index.js`)

## Development

Run from the repository root:

```bash
yarn workspace @verii/fineract-client test
yarn workspace @verii/fineract-client lint
```

