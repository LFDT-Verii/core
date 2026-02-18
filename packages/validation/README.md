# @verii/validation

Validation package for Velocity Projects, based on ajv and fastify validation

## Installation

```bash
yarn add @verii/validation
```

## Usage

```js
const { initValidation, validationPlugin, wrapValidationError } = require('@verii/validation');

// Use the exported members for your workflow.
```

## Entry Point

- `index.js`

## Top-level Exports

- `initValidation`
- `validationPlugin`
- `wrapValidationError`

## Development

Run from the repository root:

```bash
yarn workspace @verii/validation test
yarn workspace @verii/validation lint
```

