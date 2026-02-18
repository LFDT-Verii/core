# @verii/common-fetchers

Set of fetchers used by Velocity Network servers

## Installation

```bash
yarn add @verii/common-fetchers
```

## Usage

```js
const { fetchJson, getCredentialDisplayDescriptor, getCredentialSchemaUris } = require('@verii/common-fetchers');

// Use the exported members for your workflow.
```

## Entry Point

- `src/index.js`

## Top-level Exports

- `fetchJson`
- `getCredentialDisplayDescriptor`
- `getCredentialSchemaUris`
- `getCredentialTypeDescriptor`
- `getCredentialTypeMetadata`
- `getOrganizationVerifiedProfile`
- `resolveDid`
- `resolveKid`
- `resolveOrgVc`

## Development

Run from the repository root:

```bash
yarn workspace @verii/common-fetchers test
yarn workspace @verii/common-fetchers lint
```

