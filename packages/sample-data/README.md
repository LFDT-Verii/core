# @verii/sample-data

Organizations, metadata and credentials that can be used for testing.

## Installation

```bash
yarn add @verii/sample-data
```

## Usage

```js
const { credentialExpired, credentialMetadata, credentialNoExpiration } = require('@verii/sample-data');

// Use the exported members for your workflow.
```

## Entry Point

- `index.js`

## Top-level Exports

- `credentialExpired`
- `credentialMetadata`
- `credentialNoExpiration`
- `credentialSubjectNotExpired`
- `credentialUnexpired`
- `genericSelfSignedCredential`
- `intermediateIssuer`
- `intermediatePrivateKey`
- `intermediatePublicKey`
- `jwtPublicKey`
- `jwtTampered`
- `jwtUntampered`
- `openBadgeCredentialExample`
- `rootIssuer`
- `rootIssuerProfile`
- `rootIssuerProfileSignedCredential`
- `rootIssuerVerifiedProfile`
- `rootPrivateKey`
- `rootPublicKey`
- `sampleEducationDegreeGraduation`
- ... and 5 more (see `index.js`)

## Development

Run from the repository root:

```bash
yarn workspace @verii/sample-data test
yarn workspace @verii/sample-data lint
```

