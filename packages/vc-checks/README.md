# @verii/vc-checks

Velocity Verifiable credentials checks functions

## Installation

```bash
yarn add @verii/vc-checks
```

## Usage

```js
const { CheckResults, CredentialStatus, VelocityRevocationListType } = require('@verii/vc-checks');

// Use the exported members for your workflow.
```

## Entry Point

- `index.js`

## Top-level Exports

- `CheckResults`
- `CredentialStatus`
- `VelocityRevocationListType`
- `VeriiProtocolVersions`
- `checkCredentialStatus`
- `checkExpiration`
- `checkHolder`
- `checkIdentityIssuer`
- `checkIssuerTrust`
- `checkJwsVcTampering`
- `extractCredentialType`
- `verifyIssuerForCredentialType`
- `verifyPrimarySourceIssuer`

## Development

Run from the repository root:

```bash
yarn workspace @verii/vc-checks test
yarn workspace @verii/vc-checks lint
```

