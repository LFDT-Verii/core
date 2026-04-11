# @verii/did-doc

Velocity DID documents library

## Installation

```bash
yarn add @verii/did-doc
```

## Usage

```js
const { addKeysToDidDoc, addServiceToDidDoc, buildDidDocWithAlternativeId } = require('@verii/did-doc');

// Use the exported members for your workflow.
```

## Entry Point

- `index.js`

## Top-level Exports

- `addKeysToDidDoc`
- `addServiceToDidDoc`
- `buildDidDocWithAlternativeId`
- `createDidDoc`
- `extractService`
- `extractVerificationKey`
- `extractVerificationMethod`
- `generateDidInfo`
- `generateProof`
- `generatePublicKeySection`
- `getDidAndAliases`
- `getDidJwkDocument`
- `getDidUriFromJwk`
- `getJwkFromDidUri`
- `isDidMatching`
- `isDidUrlWithFragment`
- `normalizeDidDoc`
- `normalizeOrganizationDidDocService`
- `normalizeOrganizationKey`
- `publicKeyToJwk`
- ... and 12 more (see `index.js`)

## Development

Run from the repository root:

```bash
yarn workspace @verii/did-doc test
yarn workspace @verii/did-doc lint
```

