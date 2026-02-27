# @verii/aws-clients

Set of aws functions and utils used by Verii projects

## Installation

```bash
yarn add @verii/aws-clients
```

## Usage

```js
const { buildRawMessage, createSesClient, createSesV2Client } = require('@verii/aws-clients');

// Use the exported members for your workflow.
```

## Entry Point

- `index.js`

## Top-level Exports

- `buildRawMessage`
- `createSesClient`
- `createSesV2Client`
- `initKmsClient`
- `initReadDocument`
- `initS3Client`
- `initSendEmailNotification`
- `initSendSmsNotification`
- `initWriteDocument`
- `sendEmailPlugin`
- `sendSmsPlugin`

## Development

Run from the repository root:

```bash
yarn workspace @verii/aws-clients test
yarn workspace @verii/aws-clients lint
```

