# @verii/fastify-plugins

Plugin for handling errors

## Installation

```bash
yarn add @verii/fastify-plugins
```

## Usage

```js
const { ERROR_CODES, addRequestId, addValidationErrorCode } = require('@verii/fastify-plugins');

// Use the exported members for your workflow.
```

## Entry Point

- `index.js`

## Top-level Exports

- `ERROR_CODES`
- `addRequestId`
- `addValidationErrorCode`
- `autoSchemaPlugin`
- `cachePlugin`
- `corsPlugin`
- `csvResponseHook`
- `ensureErrorCode`
- `errorsPlugin`
- `extractRequestPath`
- `fastifyVersionPluginFactory`
- `getDocsUrl`
- `httpClientPlugin`
- `responseRequestIdPlugin`
- `sendErrorPlugin`
- `vnfProtocolVersionPlugin`

## Development

Run from the repository root:

```bash
yarn workspace @verii/fastify-plugins test
yarn workspace @verii/fastify-plugins lint
```

