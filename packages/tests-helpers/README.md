# @verii/tests-helpers

Generic helpers for tests

## Installation

```bash
yarn add @verii/tests-helpers
```

## Usage

```js
const { DEFAULT_GROUP_ID, abi, buildMongoConnection } = require('@verii/tests-helpers');

// Use the exported members for your workflow.
```

## Entry Point

- `index.js`

## Top-level Exports

- `DEFAULT_GROUP_ID`
- `abi`
- `buildMongoConnection`
- `deleteS3Object`
- `errorResponseMatcher`
- `generateKeyPairInHexAndJwk`
- `generateOrganizationKeyMatcher`
- `getObject`
- `jsonify`
- `loadTestEnv`
- `mongoCloseWrapper`
- `mongoFactoryWrapper`
- `mongoify`
- `privateJwkMatcher`
- `publicJwkMatcher`
- `testAdminPayMethodsUser`
- `testAuthToken`
- `testIAMSuperUser`
- `testNoGroupRegistrarUser`
- `testPurchaseCouponsUser`
- ... and 6 more (see `index.js`)

## Development

Run from the repository root:

```bash
yarn workspace @verii/tests-helpers test
yarn workspace @verii/tests-helpers lint
```

